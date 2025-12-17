// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let board, currentPlayer, selectedPiece, mode, possibleMoves, shootTargets;
let moveHistory, moveNumber, castling, gameMode, aiLevel, aiColor;
let killerMoves = {};
let historyTable = {};
let aiThinking = false;
let aiStatusElement = null;
let aiWorker = null;

const pieceSymbols = {
  K: "♚",
  Q: "♛",
  R: "♜",
  B: "♝",
  N: "♞",
  P: "♟",
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

const initialBoard = [
  ["r", "n", "b", "q", "k", "b", "n", "r"],
  ["p", "p", "p", "p", "p", "p", "p", "p"],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ["P", "P", "P", "P", "P", "P", "P", "P"],
  ["R", "N", "B", "Q", "K", "B", "N", "R"],
];

// === МЕНЮ ===
function showDifficulty() {
  document.getElementById("human-btn").style.display = "none";
  document.getElementById("ai-btn").style.display = "none";
  document.getElementById("difficulty-group").style.display = "flex";
}

function showMainMenu() {
  document.getElementById("main-menu").style.display = "flex";
  document.getElementById("pgn-window").style.display = "none";
}

function startGame(mode, level = null) {
  gameMode = mode;
  aiLevel = level;
  aiColor = "black";
  resetGame();
  document.getElementById("main-menu").style.display = "none";
}

function resetGame() {
  board = JSON.parse(JSON.stringify(initialBoard));
  currentPlayer = "white";
  selectedPiece = null;
  mode = null;
  possibleMoves = [];
  shootTargets = [];
  moveHistory = [];
  moveNumber = 1;
  castling = {
    whiteKingside: true,
    whiteQueenside: true,
    blackKingside: true,
    blackQueenside: true,
  };
  document.getElementById("status").textContent = "Ход белых";
  renderBoard();
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function isWhite(piece) {
  return piece && piece === piece.toUpperCase();
}
function isBlack(piece) {
  return piece && piece === piece.toLowerCase();
}
function isEnemy(piece, forWhite) {
  return piece && (forWhite ? isBlack(piece) : isWhite(piece));
}
function isFriend(piece, forWhite) {
  return piece && !isEnemy(piece, forWhite);
}

function addToPGN(text) {
  if (currentPlayer === "white") {
    moveHistory.push(`${moveNumber}. ${text}`);
    moveNumber++;
  } else {
    const last = moveHistory[moveHistory.length - 1];
    if (last && last.includes(".")) {
      moveHistory[moveHistory.length - 1] = last + ` ${text}`;
    } else {
      moveHistory.push(`... ${text}`);
    }
  }
  updatePGNDisplay();
}

function logShot(fromRow, fromCol, toRow, toCol) {
  const cols = "abcdefgh";
  const fromSquare = cols[fromCol] + (8 - fromRow);
  const toSquare = cols[toCol] + (8 - toRow);
  const notation = `{ ${fromSquare}🏹${toSquare} }`;
  addToPGN(notation);
}

function updatePGNDisplay() {
  const content = document.getElementById("pgn-content");
  content.textContent = moveHistory.join("\n");
  content.scrollTop = content.scrollHeight;
}

function canCastle(white, kingside) {
  if (white) {
    if (kingside) {
      if (!castling.whiteKingside) return false;
      if (board[7][4] !== "K" || board[7][7] !== "R") return false;
      if (board[7][5] !== null || board[7][6] !== null) return false;
      return true;
    } else {
      if (!castling.whiteQueenside) return false;
      if (board[7][4] !== "K" || board[7][0] !== "R") return false;
      if (board[7][1] !== null || board[7][2] !== null || board[7][3] !== null)
        return false;
      return true;
    }
  } else {
    if (kingside) {
      if (!castling.blackKingside) return false;
      if (board[0][4] !== "k" || board[0][7] !== "r") return false;
      if (board[0][5] !== null || board[0][6] !== null) return false;
      return true;
    } else {
      if (!castling.blackQueenside) return false;
      if (board[0][4] !== "k" || board[0][0] !== "r") return false;
      if (board[0][1] !== null || board[0][2] !== null || board[0][3] !== null)
        return false;
      return true;
    }
  }
}

function getValidMoves(row, col, piece) {
  const moves = [];
  const white = isWhite(piece);
  const type = piece.toLowerCase();

  function addDirection(dr, dc, limit = 7) {
    let r = row + dr,
      c = col + dc,
      steps = 0;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && steps < limit) {
      if (board[r][c] === null) moves.push([r, c]);
      else {
        if (isEnemy(board[r][c], white)) moves.push([r, c]);
        break;
      }
      r += dr;
      c += dc;
      steps++;
    }
  }

  switch (type) {
    case "p":
      const dir = white ? -1 : 1;
      if (row + dir >= 0 && row + dir < 8 && board[row + dir][col] === null) {
        moves.push([row + dir, col]);
        if ((white && row === 6) || (!white && row === 1)) {
          if (board[row + 2 * dir][col] === null)
            moves.push([row + 2 * dir, col]);
        }
      }
      for (let dc of [-1, 1]) {
        const r2 = row + dir,
          c2 = col + dc;
        if (
          r2 >= 0 &&
          r2 < 8 &&
          c2 >= 0 &&
          c2 < 8 &&
          isEnemy(board[r2][c2], white)
        ) {
          moves.push([r2, c2]);
        }
      }
      break;
    case "r":
      for (let d of [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ])
        addDirection(d[0], d[1]);
      break;
    case "b":
      for (let d of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ])
        addDirection(d[0], d[1]);
      break;
    case "q":
      for (let d of [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ])
        addDirection(d[0], d[1]);
      break;
    case "k":
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const r2 = row + dr,
            c2 = col + dc;
          if (
            r2 >= 0 &&
            r2 < 8 &&
            c2 >= 0 &&
            c2 < 8 &&
            !isFriend(board[r2][c2], white)
          ) {
            moves.push([r2, c2]);
          }
        }
      }
      if (white) {
        if (canCastle(true, true)) moves.push([7, 6]);
        if (canCastle(true, false)) moves.push([7, 2]);
      } else {
        if (canCastle(false, true)) moves.push([0, 6]);
        if (canCastle(false, false)) moves.push([0, 2]);
      }
      break;
    case "n":
      const offsets = [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ];
      for (let i = 0; i < offsets.length; i++) {
        const dr = offsets[i][0],
          dc = offsets[i][1];
        const r2 = row + dr,
          c2 = col + dc;
        if (
          r2 >= 0 &&
          r2 < 8 &&
          c2 >= 0 &&
          c2 < 8 &&
          !isFriend(board[r2][c2], white)
        ) {
          moves.push([r2, c2]);
        }
      }
      break;
  }
  return moves;
}

function getShootTargets(row, col, piece) {
  const targets = [];
  const white = isWhite(piece);
  const type = piece.toLowerCase();

  function addShootDirection(dr, dc) {
    let r = row + dr,
      c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      if (board[r][c] !== null) {
        if (isEnemy(board[r][c], white)) targets.push([r, c]);
        break;
      }
      r += dr;
      c += dc;
    }
  }

  switch (type) {
    case "p":
      const dir = white ? -1 : 1;
      for (let dc of [-1, 1]) {
        const r2 = row + dir,
          c2 = col + dc;
        if (
          r2 >= 0 &&
          r2 < 8 &&
          c2 >= 0 &&
          c2 < 8 &&
          isEnemy(board[r2][c2], white)
        ) {
          targets.push([r2, c2]);
        }
      }
      break;
    case "r":
      for (let d of [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ])
        addShootDirection(d[0], d[1]);
      break;
    case "b":
      for (let d of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ])
        addShootDirection(d[0], d[1]);
      break;
    case "q":
      for (let d of [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ])
        addShootDirection(d[0], d[1]);
      break;
    case "k":
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const r2 = row + dr,
            c2 = col + dc;
          if (
            r2 >= 0 &&
            r2 < 8 &&
            c2 >= 0 &&
            c2 < 8 &&
            isEnemy(board[r2][c2], white)
          ) {
            targets.push([r2, c2]);
          }
        }
      }
      break;
    case "n":
      const offsets = [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ];
      for (let i = 0; i < offsets.length; i++) {
        const dr = offsets[i][0],
          dc = offsets[i][1];
        const r2 = row + dr,
          c2 = col + dc;
        if (
          r2 >= 0 &&
          r2 < 8 &&
          c2 >= 0 &&
          c2 < 8 &&
          isEnemy(board[r2][c2], white)
        ) {
          targets.push([r2, c2]);
        }
      }
      break;
  }
  return targets;
}

function updateCastling(fromRow, fromCol, toRow, toCol, piece) {
  if (piece === "K") {
    castling.whiteKingside = false;
    castling.whiteQueenside = false;
  }
  if (piece === "k") {
    castling.blackKingside = false;
    castling.blackQueenside = false;
  }
  if (piece === "R") {
    if (fromCol === 0) castling.whiteQueenside = false;
    if (fromCol === 7) castling.whiteKingside = false;
  }
  if (piece === "r") {
    if (fromCol === 0) castling.blackQueenside = false;
    if (fromCol === 7) castling.blackKingside = false;
  }
}

function makeMove(fromRow, fromCol, toRow, toCol) {
  const piece = board[fromRow][fromCol];
  const captured = board[toRow][toCol] !== null;
  let notation = "";
  const cols = "abcdefgh";
  const toColChar = cols[toCol];
  const toRank = 8 - toRow;

  if (piece === "K" && fromRow === 7 && fromCol === 4) {
    if (toCol === 6) {
      board[7][5] = "R";
      board[7][7] = null;
      notation = "O-O";
    } else if (toCol === 2) {
      board[7][3] = "R";
      board[7][0] = null;
      notation = "O-O-O";
    }
  } else if (piece === "k" && fromRow === 0 && fromCol === 4) {
    if (toCol === 6) {
      board[0][5] = "r";
      board[0][7] = null;
      notation = "O-O";
    } else if (toCol === 2) {
      board[0][3] = "r";
      board[0][0] = null;
      notation = "O-O-O";
    }
  }

  if (!notation) {
    const pieceChar = piece.toLowerCase() === "p" ? "" : piece.toUpperCase();
    notation = captured
      ? `${pieceChar}🏹${toColChar}${toRank}`
      : `${pieceChar}${toColChar}${toRank}`;
  }

  board[toRow][toCol] = piece;
  board[fromRow][fromCol] = null;
  updateCastling(fromRow, fromCol, toRow, toCol, piece);
  addToPGN(notation);
}

// === ЭФФЕКТЫ ===
function playShootSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      800,
      audioCtx.currentTime + 0.1
    );
    oscillator.frequency.exponentialRampToValueAtTime(
      200,
      audioCtx.currentTime + 0.2
    );
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioCtx.currentTime + 0.3
    );
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.3);
  } catch (e) {
    console.warn("Звук не поддерживается:", e);
  }
}

function showBlood(row, col) {
  const square = document.querySelector(
    `.square[data-row="${row}"][data-col="${col}"]`
  );
  if (!square) return;
  const blood = document.createElement("div");
  blood.className = "blood";
  blood.textContent = "●";
  blood.style.left = "50%";
  blood.style.top = "50%";
  blood.style.transform = "translate(-50%, -50%)";
  square.appendChild(blood);
  setTimeout(() => {
    if (blood.parentNode) blood.parentNode.removeChild(blood);
  }, 1000);
}

function shootLaser(fromRow, fromCol, toRow, toCol) {
  const boardEl = document.getElementById("chessboard");
  const from = document.querySelector(
    `.square[data-row="${fromRow}"][data-col="${fromCol}"]`
  );
  const to = document.querySelector(
    `.square[data-row="${toRow}"][data-col="${toCol}"]`
  );
  if (!from || !to) return;
  const fromRect = from.getBoundingClientRect();
  const toRect = to.getBoundingClientRect();
  const boardRect = boardEl.getBoundingClientRect();
  const x1 = fromRect.left + fromRect.width / 2 - boardRect.left;
  const y1 = fromRect.top + fromRect.height / 2 - boardRect.top;
  const x2 = toRect.left + toRect.width / 2 - boardRect.left;
  const y2 = toRect.top + toRect.height / 2 - boardRect.top;
  const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const laser = document.createElement("div");
  laser.className = "laser";
  laser.style.left = x1 + "px";
  laser.style.top = y1 + "px";
  laser.style.width = "0px";
  laser.style.transform = `rotate(${angle}deg)`;
  laser.style.setProperty("--laser-length", length + "px");
  boardEl.appendChild(laser);
  setTimeout(() => {
    if (laser.parentNode) laser.parentNode.removeChild(laser);
  }, 300);
}

function clearHighlights() {
  document
    .querySelectorAll(".highlight, .move-possible, .target")
    .forEach((el) => {
      el.classList.remove("highlight", "move-possible", "target");
    });
  selectedPiece = null;
  mode = null;
  possibleMoves = [];
  shootTargets = [];
}

function renderBoard() {
  const boardEl = document.getElementById("chessboard");
  boardEl.innerHTML = "";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = document.createElement("div");
      square.className = `square ${(row + col) % 2 === 0 ? "white" : "black"}`;
      square.dataset.row = row;
      square.dataset.col = col;
      const piece = board[row][col];
      if (piece) {
        square.textContent = pieceSymbols[piece];
        square.className += isWhite(piece) ? " piece-white" : " piece-black";
      }
      square.addEventListener("mousedown", (e) => {
        e.preventDefault();
        handleSquareClick(row, col, e.button);
      });
      boardEl.appendChild(square);
    }
  }

  if (selectedPiece) {
    const [r, c] = selectedPiece;
    document
      .querySelector(`.square[data-row="${r}"][data-col="${c}"]`)
      .classList.add("highlight");
  }
  for (const [r, c] of possibleMoves) {
    document
      .querySelector(`.square[data-row="${r}"][data-col="${c}"]`)
      .classList.add("move-possible");
  }
  for (const [r, c] of shootTargets) {
    document
      .querySelector(`.square[data-row="${r}"][data-col="${c}"]`)
      .classList.add("target");
  }
}

function checkKingAlive() {
  const enemyKing = currentPlayer === "white" ? "k" : "K";
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === enemyKing) return true;
    }
  }
  return false;
}

// === ИИ ===
function evaluate(board) {
  const weights = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const value = weights[piece.toUpperCase()] || 0;
        if (isWhite(piece)) score += value;
        else score -= value;
      }
    }
  }
  return score;
}

function getAllMoves(board, side) {
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      if (
        (side === "white" && isWhite(piece)) ||
        (side === "black" && isBlack(piece))
      ) {
        const validMoves = getValidMoves(r, c, piece);
        for (const [toR, toC] of validMoves) {
          moves.push({ from: [r, c], to: [toR, toC], type: "move" });
        }
        const shootTargets = getShootTargets(r, c, piece);
        for (const [toR, toC] of shootTargets) {
          moves.push({ from: [r, c], to: [toR, toC], type: "shoot" });
        }
      }
    }
  }
  return moves;
}

function makeMoveCopy(board, move) {
  const newBoard = JSON.parse(JSON.stringify(board));
  const [fromR, fromC] = move.from;
  const [toR, toC] = move.to;
  if (move.type === "move") {
    const piece = newBoard[fromR][fromC];
    if (piece === "K" && fromR === 7 && fromC === 4) {
      if (toC === 6) {
        newBoard[7][5] = "R";
        newBoard[7][7] = null;
      } else if (toC === 2) {
        newBoard[7][3] = "R";
        newBoard[7][0] = null;
      }
    } else if (piece === "k" && fromR === 0 && fromC === 4) {
      if (toC === 6) {
        newBoard[0][5] = "r";
        newBoard[0][7] = null;
      } else if (toC === 2) {
        newBoard[0][3] = "r";
        newBoard[0][0] = null;
      }
    }
    newBoard[toR][toC] = piece;
    newBoard[fromR][fromC] = null;
  } else if (move.type === "shoot") {
    newBoard[toR][toC] = null;
  }
  return newBoard;
}

function scoreMove(move, board, depth) {
  const [fromR, fromC] = move.from;
  const [toR, toC] = move.to;
  const piece = board[fromR][fromC];
  const target = board[toR][toC];

  let score = 0;
  if (target) {
    const values = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 100 };
    score += (values[target.toUpperCase()] || 0) * 100;
  }
  const hKey = `${fromR},${fromC}->${toR},${toC}`;
  if (historyTable[hKey]) score += historyTable[hKey];
  return score;
}

let totalEvaluated = 0;
let threatScore = 0;

function minimaxOptimized(
  board,
  depth,
  alpha,
  beta,
  maximizing,
  startTime,
  maxTime
) {
  if (Date.now() - startTime > maxTime) {
    return maximizing ? -100000 : 100000;
  }
  if (depth === 0) {
    totalEvaluated++;
    return evaluate(board);
  }

  const side = maximizing ? "white" : "black";
  const moves = getAllMoves(board, side);
  if (moves.length === 0) {
    return maximizing ? -100000 : 100000;
  }

  moves.sort((a, b) => scoreMove(b, board, depth) - scoreMove(a, board, depth));

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const newBoard = makeMoveCopy(board, move);
      const eval = minimaxOptimized(
        newBoard,
        depth - 1,
        alpha,
        beta,
        false,
        startTime,
        maxTime
      );
      maxEval = Math.max(maxEval, eval);
      alpha = Math.max(alpha, eval);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const newBoard = makeMoveCopy(board, move);
      const eval = minimaxOptimized(
        newBoard,
        depth - 1,
        alpha,
        beta,
        true,
        startTime,
        maxTime
      );
      minEval = Math.min(minEval, eval);
      beta = Math.min(beta, eval);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function calculateThreats(board, side) {
  // Простая оценка угроз: сколько фигур может быть побито следующим ходом
  let threats = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (
        piece &&
        ((side === "white" && isBlack(piece)) ||
          (side === "black" && isWhite(piece)))
      ) {
        const moves = getValidMoves(r, c, piece);
        for (const [tr, tc] of moves) {
          if (board[tr][tc] && isEnemy(board[tr][tc], side === "white")) {
            threats++;
          }
        }
      }
    }
  }
  return Math.min(100, Math.round(threats * 5)); // до 100%
}

function initAIWorker() {
  if (!aiWorker) {
    aiWorker = new Worker("ai-worker.js");
    aiWorker.onmessage = function (e) {
      const { bestMove } = e.data;
      if (bestMove) {
        // Выполняем ход
        if (bestMove.type === "move") {
          makeMove(
            bestMove.from[0],
            bestMove.from[1],
            bestMove.to[0],
            bestMove.to[1]
          );
          if (board[bestMove.to[0]][bestMove.to[1]] !== null) {
            showBlood(bestMove.to[0], bestMove.to[1]);
          }
        } else if (bestMove.type === "shoot") {
          logShot(
            bestMove.from[0],
            bestMove.from[1],
            bestMove.to[0],
            bestMove.to[1]
          );
          playShootSound();
          shootLaser(
            bestMove.from[0],
            bestMove.from[1],
            bestMove.to[0],
            bestMove.to[1]
          );
          setTimeout(() => {
            board[bestMove.to[0]][bestMove.to[1]] = null;
            showBlood(bestMove.to[0], bestMove.to[1]);
          }, 300);
        }

        if (!checkKingAlive()) {
          const winner = currentPlayer === "white" ? "Белые" : "Чёрные";
          document.getElementById(
            "status"
          ).textContent = `⚔️ ${winner} победили!`;
          setTimeout(() => alert(`${winner} победили!`), 100);
        } else {
          currentPlayer = currentPlayer === "white" ? "black" : "white";
          document.getElementById("status").textContent =
            currentPlayer === "white" ? "Ход белых" : "Ход чёрных";
          clearHighlights();
          renderBoard();
        }
      }
      aiThinking = false;
    };
  }
}

function aiMove() {
  if (gameMode !== "ai" || currentPlayer !== aiColor || aiThinking) return;

  // Создаём/показываем статус
  if (!aiStatusElement) {
    aiStatusElement = document.createElement("div");
    aiStatusElement.id = "ai-status";
    aiStatusElement.style.cssText = `
      position: fixed; top: 20px; right: 180px;
      background: rgba(0,0,0,0.85); color: #0f0; padding: 10px;
      border-radius: 6px; font-family: monospace; font-size: 13px;
      z-index: 1000; display: block; line-height: 1.4;
    `;
    document.body.appendChild(aiStatusElement);
  } else {
    aiStatusElement.style.display = "block";
  }

  aiThinking = true;
  const maxTime = aiLevel === 5 ? 30000 : aiLevel === 4 ? 5000 : 2000; // 30 сек для Терминатора
  const startTime = Date.now();
  let timerInterval = null;

  // === СРАЗУ ВЫВОДИМ ТАЙМЕР ===
  let remainingTime = maxTime;
  aiStatusElement.innerHTML = `
  Угрозы: 25%<br>
  Глубина: 4/5<br>
  Время: ${(remainingTime / 1000).toFixed(1)}s
`;

  // Обновляем таймер каждую 100 мс
  timerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    remainingTime = Math.max(0, maxTime - elapsed);
    aiStatusElement.innerHTML = `
  Угрозы: 25%<br>
  Глубина: 4/5<br>
  Время: ${(remainingTime / 1000).toFixed(1)}s
`;

    if (remainingTime <= 0) {
      clearInterval(timerInterval);
    }
  }, 100);

  // Запускаем поиск с небольшой задержкой (чтобы таймер успел показаться)
  setTimeout(() => {
    const maxDepth = aiLevel === 5 ? 5 : aiLevel === 4 ? 4 : aiLevel + 1;
    let bestMove = null;
    let totalNodes = 0;

    // Простой синхронный поиск (но с прерыванием по времени)
    const moves = getAllMoves(board, currentPlayer);
    let bestValue = currentPlayer === "white" ? -Infinity : Infinity;

    for (let i = 0; i < moves.length; i++) {
      if (Date.now() - startTime > maxTime) break;

      const move = moves[i];
      const newBoard = makeMoveCopy(board, move);
      const value = minimaxOptimized(
        newBoard,
        maxDepth - 1,
        -Infinity,
        Infinity,
        currentPlayer !== "white",
        startTime,
        maxTime
      );
      totalNodes++;

      if (currentPlayer === "white" ? value > bestValue : value < bestValue) {
        bestValue = value;
        bestMove = move;
      }

      // Обновляем статус каждые 100 ходов
      if (totalNodes % 100 === 0) {
        aiStatusElement.innerHTML = `
          Время: ${(remainingTime / 1000).toFixed(1)}s<br>
          Узлов: ${totalNodes}
        `;
      }
    }

    // Применяем ход
    if (bestMove) {
      if (bestMove.type === "move") {
        makeMove(
          bestMove.from[0],
          bestMove.from[1],
          bestMove.to[0],
          bestMove.to[1]
        );
        if (board[bestMove.to[0]][bestMove.to[1]] !== null) {
          showBlood(bestMove.to[0], bestMove.to[1]);
        }
      } else if (bestMove.type === "shoot") {
        logShot(
          bestMove.from[0],
          bestMove.from[1],
          bestMove.to[0],
          bestMove.to[1]
        );
        playShootSound();
        shootLaser(
          bestMove.from[0],
          bestMove.from[1],
          bestMove.to[0],
          bestMove.to[1]
        );
        setTimeout(() => {
          board[bestMove.to[0]][bestMove.to[1]] = null;
          showBlood(bestMove.to[0], bestMove.to[1]);
        }, 300);
      }

      if (!checkKingAlive()) {
        const winner = currentPlayer === "white" ? "Белые" : "Чёрные";
        document.getElementById(
          "status"
        ).textContent = `⚔️ ${winner} победили!`;
      } else {
        currentPlayer = currentPlayer === "white" ? "black" : "white";
        document.getElementById("status").textContent =
          currentPlayer === "white" ? "Ход белых" : "Ход чёрных";
        clearHighlights();
        renderBoard();
      }
    }

    clearInterval(timerInterval);
    aiStatusElement.style.display = "none";
    aiThinking = false;
  }, 50); // небольшая задержка для отрисовки таймера
}

// === ОСНОВНОЙ ОБРАБОТЧИК ===
function handleSquareClick(row, col, button) {
  if (gameMode === "ai" && currentPlayer === aiColor) return;

  const piece = board[row][col];
  const isOwnPiece =
    (currentPlayer === "white" && isWhite(piece)) ||
    (currentPlayer === "black" && isBlack(piece));

  if (button === 2) {
    if (mode === "shoot" && selectedPiece) {
      const isValidTarget = shootTargets.some(
        (t) => t[0] === row && t[1] === col
      );
      if (isValidTarget) {
        playShootSound();
        const [fromR, fromC] = selectedPiece;
        shootLaser(fromR, fromC, row, col);
        setTimeout(() => {
          logShot(fromR, fromC, row, col);
          board[row][col] = null;
          showBlood(row, col);

          if (!checkKingAlive()) {
            const winner = currentPlayer === "white" ? "Белые" : "Чёрные";
            document.getElementById(
              "status"
            ).textContent = `☠️ ${winner} победили! Король уничтожен.`;
            setTimeout(() => alert(`${winner} победили!\nКороль убит.`), 100);
            clearHighlights();
            renderBoard();
            return;
          }

          currentPlayer = currentPlayer === "white" ? "black" : "white";
          document.getElementById("status").textContent =
            currentPlayer === "white" ? "Ход белых" : "Ход чёрных";
          clearHighlights();
          renderBoard();

          if (gameMode === "ai" && currentPlayer === aiColor) {
            setTimeout(aiMove, 400);
          }
        }, 300);
        return;
      } else {
        clearHighlights();
        renderBoard();
        return;
      }
    }

    if (isOwnPiece) {
      clearHighlights();
      selectedPiece = [row, col];
      shootTargets = getShootTargets(row, col, piece);
      mode = "shoot";
      renderBoard();
      return;
    }

    clearHighlights();
    renderBoard();
    return;
  }

  if (button === 0) {
    if (mode === "move" && selectedPiece) {
      const isValidMove = possibleMoves.some(
        (m) => m[0] === row && m[1] === col
      );
      if (isValidMove) {
        const [fromR, fromC] = selectedPiece;
        const captured = board[row][col] !== null;
        makeMove(fromR, fromC, row, col);
        if (captured) showBlood(row, col);

        if (!checkKingAlive()) {
          const winner = currentPlayer === "white" ? "Белые" : "Чёрные";
          document.getElementById(
            "status"
          ).textContent = `⚔️ ${winner} победили!`;
          setTimeout(() => alert(`${winner} победили!`), 100);
          clearHighlights();
          renderBoard();
          return;
        }

        currentPlayer = currentPlayer === "white" ? "black" : "white";
        document.getElementById("status").textContent =
          currentPlayer === "white" ? "Ход белых" : "Ход чёрных";
        clearHighlights();
        renderBoard();

        if (gameMode === "ai" && currentPlayer === aiColor) {
          setTimeout(aiMove, 400);
        }
        return;
      } else {
        clearHighlights();
        renderBoard();
        return;
      }
    }

    if (isOwnPiece) {
      clearHighlights();
      selectedPiece = [row, col];
      possibleMoves = getValidMoves(row, col, piece);
      mode = "move";
      renderBoard();
      return;
    }

    clearHighlights();
    renderBoard();
    return;
  }
}

// === UI ===
document.getElementById("pgn-button").addEventListener("click", () => {
  const win = document.getElementById("pgn-window");
  const isHidden = window.getComputedStyle(win).display === "none";
  win.style.display = isHidden ? "flex" : "none";
  if (isHidden) updatePGNDisplay();
});

document.getElementById("pgn-close").addEventListener("click", () => {
  document.getElementById("pgn-window").style.display = "none";
});

let isDragging = false,
  dragOffsetX,
  dragOffsetY;
const header = document.getElementById("pgn-header");
const win = document.getElementById("pgn-window");
header.addEventListener("mousedown", (e) => {
  isDragging = true;
  const rect = win.getBoundingClientRect();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;
  e.preventDefault();
});
document.addEventListener("mousemove", (e) => {
  if (isDragging) {
    win.style.left = e.clientX - dragOffsetX + "px";
    win.style.top = e.clientY - dragOffsetY + "px";
    win.style.right = "auto";
    win.style.bottom = "auto";
  }
});
document.addEventListener("mouseup", () => {
  isDragging = false;
});
document.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("beforeunload", () => {
  if (aiWorker) aiWorker.terminate();
});

// === ЗАПУСК ===
resetGame();
