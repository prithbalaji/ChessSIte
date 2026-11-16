"use strict";

const STORAGE_KEY = "quiet-square-games-v1";
const FILES = "abcdefgh";
const PIECE_GLYPHS = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟"
};
const PIECE_NAMES = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };
const START_BOARD = [
  ["br", "bn", "bb", "bq", "bk", "bb", "bn", "br"],
  ["bp", "bp", "bp", "bp", "bp", "bp", "bp", "bp"],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ["wp", "wp", "wp", "wp", "wp", "wp", "wp", "wp"],
  ["wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"]
];

const boardElement = document.querySelector("#chessboard");
const moveListElement = document.querySelector("#move-list");
const savedGamesElement = document.querySelector("#saved-games");
const toastElement = document.querySelector("#toast");
let games = loadGames();
let activeGameId = games[0]?.id ?? null;
let selectedSquare = null;
let selectedMoves = [];
let toastTimer;

function makeGame(name) {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    board: START_BOARD.map((row) => [...row]),
    turn: "w",
    castling: { K: true, Q: true, k: true, q: true },
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
    moves: [],
    captured: { w: [], b: [] },
    status: "playing",
    result: null
  };
}

function loadGames() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter((game) =>
      game && typeof game.id === "string" && Array.isArray(game.board) &&
      typeof game.name === "string" && Array.isArray(game.moves)
    );
  } catch (error) {
    console.error("Could not load saved games.", error);
    return [];
  }
}

function saveGames() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  } catch (error) {
    console.error("Could not save games to this browser.", error);
    showToast("Couldn't save games on this device.");
  }
}

function currentGame() {
  return games.find((game) => game.id === activeGameId) ?? null;
}

function persistCurrent() {
  const game = currentGame();
  if (!game) return;
  game.updatedAt = new Date().toISOString();
  games = [game, ...games.filter((item) => item.id !== game.id)];
  saveGames();
}

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function inBounds(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function colorOf(piece) {
  return piece?.[0] ?? null;
}

function findKing(board, color) {
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      if (board[row][col] === `${color}k`) return [row, col];
    }
  }
  return null;
}

function isAttacked(board, row, col, byColor) {
  const pawnRow = row + (byColor === "w" ? 1 : -1);
  for (const pawnCol of [col - 1, col + 1]) {
    if (inBounds(pawnRow, pawnCol) && board[pawnRow][pawnCol] === `${byColor}p`) return true;
  }

  for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
    const r = row + dr;
    const c = col + dc;
    if (inBounds(r, c) && board[r][c] === `${byColor}n`) return true;
  }

  for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
    let r = row + dr;
    let c = col + dc;
    let distance = 1;
    while (inBounds(r, c)) {
      const piece = board[r][c];
      if (piece) {
        if (colorOf(piece) === byColor) {
          const type = piece[1];
          if (type === "k" && distance === 1) return true;
          if ((dr === 0 || dc === 0) && (type === "r" || type === "q")) return true;
          if (dr !== 0 && dc !== 0 && (type === "b" || type === "q")) return true;
        }
        break;
      }
      r += dr;
      c += dc;
      distance += 1;
    }
  }
  return false;
}

function isInCheck(board, color) {
  const king = findKing(board, color);
  return king ? isAttacked(board, king[0], king[1], color === "w" ? "b" : "w") : false;
}

function pseudoMoves(game, row, col) {
  const board = game.board;
  const piece = board[row][col];
  if (!piece) return [];
  const color = colorOf(piece);
  const type = piece[1];
  const moves = [];
  const add = (toRow, toCol, extra = {}) => {
    if (!inBounds(toRow, toCol)) return false;
    const target = board[toRow][toCol];
    if (target && (colorOf(target) === color || target[1] === "k")) return false;
    moves.push({ from: [row, col], to: [toRow, toCol], ...extra });
    return !target;
  };

  if (type === "p") {
    const direction = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    const oneRow = row + direction;
    if (inBounds(oneRow, col) && !board[oneRow][col]) {
      add(oneRow, col);
      const twoRow = row + direction * 2;
      if (row === startRow && !board[twoRow][col]) add(twoRow, col);
    }
    for (const targetCol of [col - 1, col + 1]) {
      if (!inBounds(oneRow, targetCol)) continue;
      const target = board[oneRow][targetCol];
      if ((target && colorOf(target) !== color && target[1] !== "k") ||
          game.enPassant?.[0] === oneRow && game.enPassant?.[1] === targetCol) {
        add(oneRow, targetCol, target ? {} : { enPassant: true });
      }
    }
  } else if (type === "n") {
    for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) add(row + dr, col + dc);
  } else if (type === "k") {
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr || dc) add(row + dr, col + dc);
      }
    }
    const enemy = color === "w" ? "b" : "w";
    const homeRow = color === "w" ? 7 : 0;
    const kingside = color === "w" ? "K" : "k";
    const queenside = color === "w" ? "Q" : "q";
    if (row === homeRow && col === 4 && !isAttacked(board, row, col, enemy)) {
      if (game.castling[kingside] && board[homeRow][7] === `${color}r` &&
          !board[homeRow][5] && !board[homeRow][6] &&
          !isAttacked(board, homeRow, 5, enemy) && !isAttacked(board, homeRow, 6, enemy)) {
        add(homeRow, 6, { castle: "K" });
      }
      if (game.castling[queenside] && board[homeRow][0] === `${color}r` &&
          !board[homeRow][1] && !board[homeRow][2] && !board[homeRow][3] &&
          !isAttacked(board, homeRow, 3, enemy) && !isAttacked(board, homeRow, 2, enemy)) {
        add(homeRow, 2, { castle: "Q" });
      }
    }
  } else {
    const directions = type === "b" ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
      : type === "r" ? [[-1, 0], [1, 0], [0, -1], [0, 1]]
        : [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    for (const [dr, dc] of directions) {
      let r = row + dr;
      let c = col + dc;
      while (inBounds(r, c)) {
        const keepGoing = add(r, c);
        if (!keepGoing) break;
        r += dr;
        c += dc;
      }
    }
  }
  return moves;
}

function applyMoveToBoard(board, move) {
  const next = cloneBoard(board);
  const [fromRow, fromCol] = move.from;
  const [toRow, toCol] = move.to;
  const piece = next[fromRow][fromCol];
  next[fromRow][fromCol] = null;
  if (move.enPassant) next[fromRow][toCol] = null;
  next[toRow][toCol] = move.promotion ? `${piece[0]}${move.promotion}` : piece;
  if (move.castle) {
    const rookFrom = move.castle === "K" ? 7 : 0;
    const rookTo = move.castle === "K" ? 5 : 3;
    next[fromRow][rookTo] = next[fromRow][rookFrom];
    next[fromRow][rookFrom] = null;
  }
  return next;
}

function legalMoves(game, row, col) {
  const piece = game.board[row][col];
  if (!piece || colorOf(piece) !== game.turn || game.status !== "playing") return [];
  return pseudoMoves(game, row, col).filter((move) =>
    !isInCheck(applyMoveToBoard(game.board, move), game.turn)
  );
}

function allLegalMoves(game, color = game.turn) {
  const moves = [];
  const oldTurn = game.turn;
  game.turn = color;
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      if (colorOf(game.board[row][col]) === color) moves.push(...legalMoves(game, row, col));
    }
  }
  game.turn = oldTurn;
  return moves;
}

function squareName([row, col]) {
  return `${FILES[col]}${8 - row}`;
}

function pieceMoveLabel(move, piece, captured, checkSuffix) {
  if (move.castle) return `${move.castle === "K" ? "O-O" : "O-O-O"}${checkSuffix}`;
  const type = piece[1];
  const captureMark = captured ? "x" : "";
  const prefix = type === "p" ? (captured ? FILES[move.from[1]] : "") : type.toUpperCase();
  const promotion = move.promotion ? `=${move.promotion.toUpperCase()}` : "";
  return `${prefix}${captureMark}${squareName(move.to)}${promotion}${checkSuffix}`;
}

function updateCastlingRights(game, piece, from, captured, to) {
  const [fromRow, fromCol] = from;
  const [toRow, toCol] = to;
  if (piece === "wk") { game.castling.K = false; game.castling.Q = false; }
  if (piece === "bk") { game.castling.k = false; game.castling.q = false; }
  if (piece === "wr" && fromRow === 7 && fromCol === 0) game.castling.Q = false;
  if (piece === "wr" && fromRow === 7 && fromCol === 7) game.castling.K = false;
  if (piece === "br" && fromRow === 0 && fromCol === 0) game.castling.q = false;
  if (piece === "br" && fromRow === 0 && fromCol === 7) game.castling.k = false;
  if (captured === "wr" && toRow === 7 && toCol === 0) game.castling.Q = false;
  if (captured === "wr" && toRow === 7 && toCol === 7) game.castling.K = false;
  if (captured === "br" && toRow === 0 && toCol === 0) game.castling.q = false;
  if (captured === "br" && toRow === 0 && toCol === 7) game.castling.k = false;
}

function playMove(move) {
  const game = currentGame();
  if (!game || game.status !== "playing") return;
  const [fromRow, fromCol] = move.from;
  const [toRow, toCol] = move.to;
  const piece = game.board[fromRow][fromCol];
  const captured = move.enPassant ? game.board[fromRow][toCol] : game.board[toRow][toCol];
  updateCastlingRights(game, piece, move.from, captured, move.to);
  if (captured) game.captured[game.turn].push(captured);
  if (piece[1] === "p" || captured) game.halfmove = 0;
  else game.halfmove += 1;
  game.board = applyMoveToBoard(game.board, move);
  game.enPassant = piece[1] === "p" && Math.abs(toRow - fromRow) === 2
    ? [(fromRow + toRow) / 2, fromCol] : null;
  if (game.turn === "b") game.fullmove += 1;
  game.turn = game.turn === "w" ? "b" : "w";
  const check = isInCheck(game.board, game.turn);
  const replies = allLegalMoves(game);
  const suffix = check ? (replies.length === 0 ? "#" : "+") : "";
  move.san = pieceMoveLabel(move, piece, captured, suffix);
  move.color = piece[0];
  game.moves.push(move);
  if (replies.length === 0) {
    game.status = check ? "checkmate" : "draw";
    game.result = check ? (game.turn === "w" ? "Black wins" : "White wins") : "Draw by stalemate";
  } else if (game.halfmove >= 100) {
    game.status = "draw";
    game.result = "Draw by 50-move rule";
  }
  selectedSquare = null;
  selectedMoves = [];
  persistCurrent();
  render();
}

function askForName(title, initialValue, submitLabel) {
  const dialog = document.querySelector("#name-dialog");
  const form = document.querySelector("#name-form");
  const input = document.querySelector("#game-name-input");
  const submitButton = document.querySelector("#name-submit");
  dialog.querySelector("#name-dialog-title").textContent = title;
  submitButton.textContent = submitLabel;
  input.value = initialValue;
  return new Promise((resolve) => {
    const finish = (value) => {
      form.removeEventListener("submit", onSubmit);
      document.querySelector("#name-cancel").removeEventListener("click", onCancel);
      dialog.removeEventListener("cancel", onEscape);
      dialog.close();
      resolve(value);
    };
    const onSubmit = (event) => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name) {
        showToast("A game name can't be empty.");
        input.focus();
        return;
      }
      finish(name);
    };
    const onCancel = () => finish(null);
    const onEscape = (event) => {
      event.preventDefault();
      finish(null);
    };
    form.addEventListener("submit", onSubmit);
    document.querySelector("#name-cancel").addEventListener("click", onCancel);
    dialog.addEventListener("cancel", onEscape);
    dialog.showModal();
    input.focus();
    input.select();
  });
}

function choosePromotion(color) {
  const dialog = document.querySelector("#promotion-dialog");
  const choices = document.querySelector("#promotion-choices");
  choices.replaceChildren();
  return new Promise((resolve) => {
    const finish = (value) => {
      choices.removeEventListener("click", onChoice);
      document.querySelector("#promotion-cancel").removeEventListener("click", onCancel);
      dialog.removeEventListener("cancel", onEscape);
      dialog.close();
      resolve(value);
    };
    const onChoice = (event) => {
      const button = event.target.closest("[data-promotion]");
      if (button) finish(button.dataset.promotion);
    };
    const onCancel = () => finish(null);
    const onEscape = (event) => {
      event.preventDefault();
      finish(null);
    };
    for (const [type, name] of [["q", "Queen"], ["r", "Rook"], ["b", "Bishop"], ["n", "Knight"]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "promotion-choice";
      button.dataset.promotion = type;
      button.setAttribute("aria-label", `Promote to ${name}`);
      const piece = document.createElement("span");
      piece.className = "promotion-piece";
      piece.textContent = PIECE_GLYPHS[`${color}${type}`];
      const label = document.createElement("span");
      label.textContent = name;
      button.append(piece, label);
      choices.append(button);
    }
    choices.addEventListener("click", onChoice);
    document.querySelector("#promotion-cancel").addEventListener("click", onCancel);
    dialog.addEventListener("cancel", onEscape);
    dialog.showModal();
  });
}

async function requestPromotion(move) {
  const game = currentGame();
  const promotion = game ? await choosePromotion(game.turn) : null;
  if (promotion) playMove({ ...move, promotion });
}

function handleSquareClick(row, col) {
  const game = currentGame();
  if (!game || game.status !== "playing") return;
  const piece = game.board[row][col];
  const candidate = selectedMoves.find((move) => move.to[0] === row && move.to[1] === col);
  if (candidate) {
    if (piece?.[1] === "k" && Math.abs(candidate.to[1] - candidate.from[1]) === 2) {
      candidate.castle = candidate.to[1] > candidate.from[1] ? "K" : "Q";
    }
    const movingPiece = game.board[candidate.from[0]][candidate.from[1]];
    if (movingPiece[1] === "p" && (row === 0 || row === 7)) requestPromotion(candidate);
    else playMove(candidate);
    return;
  }
  if (piece && colorOf(piece) === game.turn) {
    selectedSquare = [row, col];
    selectedMoves = legalMoves(game, row, col);
  } else {
    selectedSquare = null;
    selectedMoves = [];
  }
  renderBoard();
}

function renderBoard() {
  const game = currentGame();
  boardElement.replaceChildren();
  if (!game) return;
  const lastMove = game.moves.at(-1);
  const checkedKing = isInCheck(game.board, game.turn) ? findKing(game.board, game.turn) : null;
  const destinations = new Set(selectedMoves.map((move) => `${move.to[0]},${move.to[1]}`));
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const square = document.createElement("button");
      square.type = "button";
      square.className = `square ${(row + col) % 2 === 0 ? "light" : "dark"}`;
      square.setAttribute("role", "gridcell");
      square.setAttribute("aria-label", `${FILES[col]}${8 - row}${game.board[row][col] ? ` ${colorOf(game.board[row][col]) === "w" ? "white" : "black"} ${PIECE_NAMES[game.board[row][col][1]]}` : ""}`);
      if (selectedSquare?.[0] === row && selectedSquare?.[1] === col) square.classList.add("selected");
      if (lastMove && [lastMove.from, lastMove.to].some(([r, c]) => r === row && c === col)) square.classList.add("last-move");
      if (checkedKing?.[0] === row && checkedKing?.[1] === col) square.classList.add("in-check");
      const piece = game.board[row][col];
      if (piece) {
        const pieceElement = document.createElement("span");
        pieceElement.className = `piece ${piece[0] === "w" ? "white" : "black"}`;
        pieceElement.textContent = PIECE_GLYPHS[piece];
        pieceElement.setAttribute("aria-hidden", "true");
        square.append(pieceElement);
      }
      if (destinations.has(`${row},${col}`)) {
        const dot = document.createElement("span");
        dot.className = "legal-dot";
        square.append(dot);
      }
      if (col === 0 || row === 7) {
        const coordinate = document.createElement("span");
        coordinate.className = "square-coordinate";
        coordinate.textContent = col === 0 && row === 7 ? `${8 - row}${FILES[col]}` : col === 0 ? String(8 - row) : FILES[col];
        square.append(coordinate);
      }
      square.addEventListener("click", () => handleSquareClick(row, col));
      boardElement.append(square);
    }
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved game";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function renderMoves(game) {
  moveListElement.replaceChildren();
  document.querySelector("#moves-empty").hidden = game.moves.length > 0;
  for (let index = 0; index < game.moves.length; index += 2) {
    const row = document.createElement("div");
    row.className = "move-row";
    const number = document.createElement("span");
    number.className = "move-number";
    number.textContent = `${Math.floor(index / 2) + 1}.`;
    const white = document.createElement("span");
    white.className = "move-cell";
    white.textContent = game.moves[index].san;
    if (index === game.moves.length - 1) white.classList.add("latest");
    const black = document.createElement("span");
    black.className = "move-cell";
    black.textContent = game.moves[index + 1]?.san ?? "";
    if (index + 1 === game.moves.length - 1) black.classList.add("latest");
    row.append(number, white, black);
    moveListElement.append(row);
  }
  moveListElement.scrollTop = moveListElement.scrollHeight;
}

function renderGames() {
  savedGamesElement.replaceChildren();
  document.querySelector("#games-empty").hidden = games.length > 0;
  document.querySelector("#game-count").textContent = String(games.length);
  for (const game of games) {
    const item = document.createElement("div");
    item.className = `saved-game${game.id === activeGameId ? " active" : ""}`;
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");
    item.setAttribute("aria-label", `Open ${game.name}`);
    const icon = document.createElement("span");
    icon.className = "saved-game-icon";
    icon.textContent = game.status === "playing" ? "♞" : "♟";
    const copy = document.createElement("div");
    copy.className = "saved-game-copy";
    const title = document.createElement("div");
    title.className = "saved-game-title";
    title.textContent = game.name;
    const meta = document.createElement("div");
    meta.className = "saved-game-meta";
    meta.textContent = `${game.moves.length} ${game.moves.length === 1 ? "move" : "moves"} · ${game.result || formatDate(game.updatedAt)}`;
    copy.append(title, meta);
    const actions = document.createElement("div");
    actions.className = "saved-game-actions";
    const rename = document.createElement("button");
    rename.type = "button";
    rename.className = "small-action";
    rename.title = "Rename game";
    rename.setAttribute("aria-label", `Rename ${game.name}`);
    rename.textContent = "✎";
    rename.addEventListener("click", (event) => {
      event.stopPropagation();
      renameGame(game.id);
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "small-action delete";
    remove.title = "Delete game";
    remove.setAttribute("aria-label", `Delete ${game.name}`);
    remove.textContent = "×";
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteGame(game.id);
    });
    actions.append(rename, remove);
    item.append(icon, copy, actions);
    item.addEventListener("click", () => openGame(game.id));
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openGame(game.id);
      }
    });
    savedGamesElement.append(item);
  }
}

function render() {
  const game = currentGame();
  if (!game) return;
  document.querySelector("#game-title").textContent = game.name;
  document.querySelector("#move-count").textContent = String(game.moves.length);
  document.querySelector("#turn-label").textContent = game.result || `${game.turn === "w" ? "White" : "Black"} to move`;
  document.querySelector("#game-status").textContent = game.result || `${game.turn === "w" ? "White" : "Black"} to move`;
  document.querySelector("#turn-dot").style.background = game.turn === "w" ? "#819e75" : "#50574b";
  document.querySelector("#white-state").textContent = game.status === "playing" && game.turn === "w" && isInCheck(game.board, "w") ? "In check" : "";
  document.querySelector("#black-state").textContent = game.status === "playing" && game.turn === "b" && isInCheck(game.board, "b") ? "In check" : "";
  document.querySelector("#white-captured").textContent = game.captured.w.map((piece) => PIECE_GLYPHS[piece]).join("");
  document.querySelector("#black-captured").textContent = game.captured.b.map((piece) => PIECE_GLYPHS[piece]).join("");
  document.querySelector("#status-indicator").style.background = game.status === "playing" ? "#819e75" : "#c89b5b";
  renderBoard();
  renderMoves(game);
  renderGames();
}

function switchTab(tab) {
  const movesSelected = tab === "moves";
  document.querySelector("#moves-tab").classList.toggle("active", movesSelected);
  document.querySelector("#games-tab").classList.toggle("active", !movesSelected);
  document.querySelector("#moves-tab").setAttribute("aria-selected", String(movesSelected));
  document.querySelector("#games-tab").setAttribute("aria-selected", String(!movesSelected));
  document.querySelector("#moves-panel").hidden = !movesSelected;
  document.querySelector("#games-panel").hidden = movesSelected;
}

async function createNewGame() {
  const suggested = `Game ${games.length + 1}`;
  const name = await askForName("Name your game", suggested, "Create game");
  if (name === null) return;
  const gameName = name.trim() || suggested;
  const game = makeGame(gameName);
  games.unshift(game);
  activeGameId = game.id;
  selectedSquare = null;
  selectedMoves = [];
  saveGames();
  switchTab("moves");
  render();
}

async function renameGame(id) {
  const game = games.find((item) => item.id === id);
  if (!game) return;
  const name = await askForName("Rename your game", game.name, "Save name");
  if (name === null) return;
  if (!name.trim()) {
    showToast("A game name can't be empty.");
    return;
  }
  game.name = name.trim();
  persistCurrentIf(id);
  saveGames();
  render();
}

function persistCurrentIf(id) {
  if (activeGameId === id) persistCurrent();
}

function deleteGame(id) {
  const game = games.find((item) => item.id === id);
  if (!game) return;
  if (!window.confirm(`Delete "${game.name}"? This can't be undone.`)) return;
  games = games.filter((item) => item.id !== id);
  if (activeGameId === id) {
    activeGameId = games[0]?.id ?? null;
    if (!activeGameId) {
      const replacement = makeGame("A new beginning");
      games.push(replacement);
      activeGameId = replacement.id;
    }
  }
  selectedSquare = null;
  selectedMoves = [];
  saveGames();
  render();
}

function openGame(id) {
  if (!games.some((game) => game.id === id)) return;
  activeGameId = id;
  selectedSquare = null;
  selectedMoves = [];
  switchTab("moves");
  render();
}

function showToast(message) {
  toastElement.textContent = message;
  toastElement.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastElement.classList.remove("visible"), 2400);
}

document.querySelector("#new-game-button").addEventListener("click", () => { void createNewGame(); });
document.querySelector("#rename-current").addEventListener("click", () => {
  if (activeGameId) renameGame(activeGameId);
});
document.querySelector("#moves-tab").addEventListener("click", () => switchTab("moves"));
document.querySelector("#games-tab").addEventListener("click", () => switchTab("games"));

if (games.length === 0) {
  const firstGame = makeGame("A new beginning");
  games.push(firstGame);
  activeGameId = firstGame.id;
  saveGames();
}
render();
