# Quiet Square Chess

A polished, browser-based chess game for playing complete two-player games on the same device. Quiet Square provides a responsive board, legal move highlighting, SAN-style move history, pawn promotion, and multiple locally saved games.

## Features

- Complete 8×8 chess board with Unicode pieces
- Legal move highlighting for the selected piece
- Check, checkmate, stalemate, and 50-move draw detection
- Castling, en passant, and pawn promotion
- Captured-piece tracking and SAN-style move notation
- Multiple named games stored automatically in `localStorage`
- Rename, reopen, and delete saved games
- Responsive layout and keyboard-accessible game controls

## Technology

Quiet Square is built with plain HTML, CSS, and JavaScript. It has no build step or third-party runtime dependencies.

- `index.html` — page structure and UI containers
- `style.css` — responsive visual design and board styling
- `app.js` — chess rules, move execution, game state, and browser storage

## Run locally

No installation is required. From a terminal in the repository directory, serve the files with a lightweight local web server:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in a browser.

The site can also be opened directly with `index.html` in many browsers, though a local HTTP server is recommended.

## How to use

1. Select a piece to see its legal moves.
2. Select a highlighted square to move it.
3. Use **New game** to create and name another game.
4. Switch to the **Games** tab to open, rename, or delete saved games.

Saved games remain in the browser profile where the site is opened. Clearing site data removes them.

## Chess rules implemented

The move engine tracks castling rights, en passant targets, halfmove counts, and fullmove counts. It also prevents moves that leave the king in check and ends a game after checkmate, stalemate, or the 50-move rule.

## Browser support

Modern browsers with support for HTML dialogs, `localStorage`, ES6 JavaScript, and CSS features such as `:has()` are recommended.
