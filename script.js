// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let board, currentPlayer, selectedPiece, mode, possibleMoves, shootTargets;
let moveHistory,
  moveNumber,
  castling,
  gameMode,
  aiLevel,
  aiColor = "black";
let reloadTurns = 1;
let reloadTimers = {};
let aiThinking = false;
let advisorEnabled = false;
let advisorWindow = null;
let isDraggingAdvisor = false;
let dragOffsetXAdvisor, dragOffsetYAdvisor;

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
  const reloadInput = document.querySelector('input[name="reload"]:checked');
  reloadTurns = reloadInput ? parseInt(reloadInput.value) : 1;
  gameMode = mode;
  aiLevel = level;
  aiColor = "black";

  // В режиме ИИ — включаем советы
  advisorEnabled = mode === "ai";

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
  reloadTimers = {};
  castling = {
    whiteKingside: true,
    whiteQueenside: true,
    blackKingside: true,
    blackQueenside: true,
  };
  document.getElementById("status").textContent = "Ход белых";
  renderBoard();

  // Обновляем советы
  if (advisorEnabled) {
    updateAdvisor();
  }
}

function analyzePosition() {
  if (typeof Chess === "undefined") {
    return "Анализ недоступен";
  }
  try {
    const chess = new Chess();

    // Применяем все ходы из PGN
    for (const notation of moveHistory) {
      // Убираем номера ходов и комментарии
      const clean = notation.replace(/^[0-9]+\.\s*|\s*\{.*?\}/g, "").trim();
      if (clean && clean !== "...") {
        try {
          chess.move(clean);
        } catch (e) {
          console.warn("Invalid move in PGN:", clean);
        }
      }
    }

    // Получаем лучший ход
    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) return "Нет доступных ходов";

    // Сортируем по оценке (в реальности chess.js не даёт оценку, но мы можем выбрать первый)
    const best = moves[0];
    return `Лучший ход: ${best.from} → ${best.to} (${best.san})`;
  } catch (e) {
    console.error("Ошибка анализа:", e);
    return "Не могу дать совет";
  }
}

function updateAdvisor() {
  if (!advisorEnabled) return;
  const content = document.getElementById("advisor-content");
  content.textContent = "Анализ...";

  // Задержка для плавности
  setTimeout(() => {
    const advice = analyzePosition();
    content.textContent = advice;
  }, 100);
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
  const key = `${row},${col}`;
  if (reloadTimers[key] > 0) return [];

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

  // --- РОКИРОВКА ---
  if (piece === "K" && fromRow === 7 && fromCol === 4) {
    if (toCol === 6) {
      board[7][5] = "R";
      board[7][7] = null;
      notation = "O-O";

      // Переносим таймер ладьи
      if (reloadTimers["7,7"] > 0) {
        reloadTimers["7,5"] = reloadTimers["7,7"];
        delete reloadTimers["7,7"];
      }
    } else if (toCol === 2) {
      board[7][3] = "R";
      board[7][0] = null;
      notation = "O-O-O";
      if (reloadTimers["7,0"] > 0) {
        reloadTimers["7,3"] = reloadTimers["7,0"];
        delete reloadTimers["7,0"];
      }
    }
  } else if (piece === "k" && fromRow === 0 && fromCol === 4) {
    if (toCol === 6) {
      board[0][5] = "r";
      board[0][7] = null;
      notation = "O-O";
      if (reloadTimers["0,7"] > 0) {
        reloadTimers["0,5"] = reloadTimers["0,7"];
        delete reloadTimers["0,7"];
      }
    } else if (toCol === 2) {
      board[0][3] = "r";
      board[0][0] = null;
      notation = "O-O-O";
      if (reloadTimers["0,0"] > 0) {
        reloadTimers["0,3"] = reloadTimers["0,0"];
        delete reloadTimers["0,0"];
      }
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

  // === ПЕРЕНЕСТИ ТАЙМЕР ПРИ ХОДЕ ===
  const fromKey = `${fromRow},${fromCol}`;
  const toKey = `${toRow},${toCol}`;
  if (reloadTimers[fromKey] > 0) {
    reloadTimers[toKey] = reloadTimers[fromKey];
    delete reloadTimers[fromKey];
  }

  updateCastling(fromRow, fromCol, toRow, toCol, piece);
  addToPGN(notation);
}

function boardToFEN() {
  let fen = "";
  for (let row = 0; row < 8; row++) {
    let empty = 0;
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece === null) {
        empty++;
      } else {
        if (empty > 0) {
          fen += empty;
          empty = 0;
        }
        fen += piece;
      }
    }
    if (empty > 0) {
      fen += empty;
    }
    if (row < 7) fen += "/";
  }

  const activeColor = currentPlayer === "white" ? "w" : "b";
  const castlingRights =
    (castling.whiteKingside ? "K" : "") +
      (castling.whiteQueenside ? "Q" : "") +
      (castling.blackKingside ? "k" : "") +
      (castling.blackQueenside ? "q" : "") || "-";

  const enPassant = "-"; // Упрощённо
  const halfmoveClock = "0";
  const fullmoveNumber = moveNumber;

  return `${fen} ${activeColor} ${castlingRights} ${enPassant} ${halfmoveClock} ${fullmoveNumber}`;
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

// === РЕНДЕР С ПЕРЕЗАРЯДКОЙ ===
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

        const key = `${row},${col}`;
        if (reloadTimers[key] > 0) {
          const reloadBar = document.createElement("div");
          reloadBar.className = "reload-bar";
          reloadBar.textContent = reloadTimers[key];
          square.appendChild(reloadBar);
        }
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
      ?.classList.add("highlight");
  }
  for (const [r, c] of possibleMoves) {
    document
      .querySelector(`.square[data-row="${r}"][data-col="${c}"]`)
      ?.classList.add("move-possible");
  }
  for (const [r, c] of shootTargets) {
    document
      .querySelector(`.square[data-row="${r}"][data-col="${c}"]`)
      ?.classList.add("target");
  }
  // Обновляем FEN
  const fenDisplay = document.getElementById("fen-display");
  if (fenDisplay) {
    fenDisplay.textContent = boardToFEN();
  }
}

function decrementReloadTimers() {
  for (const key in reloadTimers) {
    if (reloadTimers[key] > 0) {
      reloadTimers[key]--;
    }
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
function aiMove() {
  if (gameMode !== "ai" || currentPlayer !== aiColor || aiThinking) return;

  aiThinking = true;
  document.getElementById("status").textContent = "Ход чёрных (ИИ)...";

  let bestAction = null;
  const actions = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && isBlack(piece)) {
        const moves = getValidMoves(r, c, piece);
        for (const to of moves) {
          actions.push({ from: [r, c], to, type: "move" });
        }
        const shoots = getShootTargets(r, c, piece);
        for (const to of shoots) {
          if (board[to[0]][to[1]] === "K") {
            bestAction = { from: [r, c], to, type: "shoot" };
            break;
          }
          actions.push({ from: [r, c], to, type: "shoot" });
        }
        if (bestAction) break;
      }
    }
    if (bestAction) break;
  }

  if (!bestAction && actions.length > 0) {
    bestAction = actions[Math.floor(Math.random() * actions.length)];
  }

  setTimeout(() => {
    if (bestAction) {
      if (bestAction.type === "move") {
        // Обычный ход — как у игрока
        makeMove(
          bestAction.from[0],
          bestAction.from[1],
          bestAction.to[0],
          bestAction.to[1]
        );
        if (board[bestAction.to[0]][bestAction.to[1]] !== null) {
          showBlood(bestAction.to[0], bestAction.to[1]);
        }
      } else if (bestAction.type === "shoot") {
        // === ВЫСТРЕЛ ИИ — ТОЧНО ТАК ЖЕ, КАК У ИГРОКА ===
        const [fromR, fromC] = bestAction.from;
        const [toR, toC] = bestAction.to;

        // Логируем выстрел
        logShot(fromR, fromC, toR, toC);

        // Проигрываем звук
        playShootSound();

        // Показываем лазер
        shootLaser(fromR, fromC, toR, toC);

        // Удаляем фигуру с задержкой (как у игрока)
        setTimeout(() => {
          board[toR][toC] = null;
          showBlood(toR, toC);

          // Устанавливаем перезарядку
          const key = `${fromR},${fromC}`;
          reloadTimers[key] = reloadTurns;

          // Проверка победы
          if (!checkKingAlive()) {
            document.getElementById(
              "status"
            ).textContent = `⚔️ Чёрные победили!`;
            setTimeout(() => alert(`Чёрные победили!`), 100);
          } else {
            currentPlayer = "white";
            document.getElementById("status").textContent = "Ход белых";
            decrementReloadTimers();
            renderBoard();
          }
        }, 300);
      } else {
        // Если ни ход, ни выстрел — просто передаём ход
        currentPlayer = "white";
        document.getElementById("status").textContent = "Ход белых";
        decrementReloadTimers();
        renderBoard();
      }
    } else {
      document.getElementById("status").textContent = `⚔️ Ничья (пат)`;
    }
    aiThinking = false;
  }, 600);
}

// === ОСНОВНОЙ ОБРАБОТЧИК ===
function handleSquareClick(row, col, button) {
  // Блокировка, если сейчас должен ходить ИИ
  if (gameMode === "ai" && currentPlayer === aiColor) {
    return;
  }

  const piece = board[row][col];
  const isOwnPiece =
    (currentPlayer === "white" && isWhite(piece)) ||
    (currentPlayer === "black" && isBlack(piece));

  // === ПКМ: Режим стрельбы ===
  if (button === 2) {
    if (isOwnPiece) {
      clearHighlights();
      selectedPiece = [row, col];
      shootTargets = getShootTargets(row, col, piece);
      mode = "shoot";
      renderBoard();
      return;
    }

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

          const key = `${fromR},${fromC}`;
          reloadTimers[key] = reloadTurns;

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

          // === ИСПРАВЛЕНО: корректная смена хода ===
          currentPlayer = currentPlayer === "white" ? "black" : "white";

          if (gameMode === "ai" && currentPlayer === aiColor) {
            document.getElementById("status").textContent =
              "Ход чёрных (ИИ)...";
          } else {
            document.getElementById("status").textContent =
              currentPlayer === "white" ? "Ход белых" : "Ход чёрных";
          }

          decrementReloadTimers();
          clearHighlights();
          renderBoard();

          if (gameMode === "ai" && currentPlayer === aiColor) {
            setTimeout(aiMove, 500);
          }
        }, 300);
        return;
      }
    }

    clearHighlights();
    renderBoard();
    return;
  }

  // === ЛКМ: Режим хода ===
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

        // === ИСПРАВЛЕНО: корректная смена хода ===
        currentPlayer = currentPlayer === "white" ? "black" : "white";

        if (gameMode === "ai" && currentPlayer === aiColor) {
          document.getElementById("status").textContent = "Ход чёрных (ИИ)...";
        } else {
          document.getElementById("status").textContent =
            currentPlayer === "white" ? "Ход белых" : "Ход чёрных";
        }

        decrementReloadTimers();
        clearHighlights();
        renderBoard();

        if (gameMode === "ai" && currentPlayer === aiColor) {
          setTimeout(aiMove, 500);
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
    if (advisorEnabled) {
      setTimeout(updateAdvisor, 300);
    }
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

// === СТИЛИ ДЛЯ ПЕРЕЗАРЯДКИ ===
const style = document.createElement("style");
style.textContent = `
  .reload-bar {
    position: absolute;
    bottom: 2px;
    left: 0;
    width: 100%;
    background: rgba(0,0,0,0.7);
    color: #ffcc00;
    font-size: 10px;
    text-align: center;
    padding: 1px 0;
    border-radius: 2px;
    pointer-events: none;
  }
  .menu-group {
    margin: 20px 0;
    text-align: center;
    color: #ccc;
  }
  .menu-group label {
    display: inline-block;
    margin: 0 10px;
    cursor: pointer;
  }
  .menu-group input[type="radio"] {
    margin-right: 5px;
  }
`;
document.head.appendChild(style);

// === ЗАПУСК ===
resetGame();

// === ОКНО СОВЕТОВ ===
document.getElementById("advisor-button").addEventListener("click", () => {
  const win = document.getElementById("advisor-window");
  win.style.display = win.style.display === "none" ? "flex" : "none";
  if (win.style.display === "flex" && advisorEnabled) {
    updateAdvisor();
  }
});

document.getElementById("advisor-close").addEventListener("click", () => {
  document.getElementById("advisor-window").style.display = "none";
});

// Drag advisor window
const advisorHeader = document.getElementById("advisor-header");
const advisorWin = document.getElementById("advisor-window");
advisorHeader.addEventListener("mousedown", (e) => {
  isDraggingAdvisor = true;
  const rect = advisorWin.getBoundingClientRect();
  dragOffsetXAdvisor = e.clientX - rect.left;
  dragOffsetYAdvisor = e.clientY - rect.top;
  e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
  if (isDraggingAdvisor) {
    advisorWin.style.left = e.clientX - dragOffsetXAdvisor + "px";
    advisorWin.style.top = e.clientY - dragOffsetYAdvisor + "px";
    advisorWin.style.right = "auto";
    advisorWin.style.bottom = "auto";
  }
});

document.addEventListener("mouseup", () => {
  isDraggingAdvisor = false;
});

const copyBtn = document.getElementById("copy-fen");
if (copyBtn) {
  copyBtn.addEventListener("click", () => {
    const fen = boardToFEN();
    navigator.clipboard.writeText(fen).then(() => {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = "Скопировано!";
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 1000);
    });
  });
}
