// ai-worker.js
let board, currentPlayer, aiLevel, maxDepth, maxTime, startTime;

// Оценочная функция
function evaluate(board) {
  const weights = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const value = weights[piece.toUpperCase()] || 0;
        if (piece === piece.toUpperCase()) score += value;
        else score -= value;
      }
    }
  }
  return score;
}

// Генерация ходов (упрощённая — только move, без shooting, но можно расширить)
function getValidMoves(board, row, col, piece) {
  // ... (вставь сюда логику getValidMoves из script.js, без DOM)
  // Для краткости — возвращаем пустой массив, но в реальности нужно полную логику
  return [];
}

function getAllMoves(board, side) {
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const isWhitePiece = piece === piece.toUpperCase();
      if (
        (side === "white" && isWhitePiece) ||
        (side === "black" && !isWhitePiece)
      ) {
        // Обычные ходы
        const validMoves = getValidMoves(board, r, c, piece);
        for (const [toR, toC] of validMoves) {
          moves.push({ from: [r, c], to: [toR, toC], type: "move" });
        }
        // Выстрелы (аналогично)
        // ...
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
    // Обработка рокировки, ходов
    newBoard[toR][toC] = newBoard[fromR][fromC];
    newBoard[fromR][fromC] = null;
  } else if (move.type === "shoot") {
    newBoard[toR][toC] = null;
  }
  return newBoard;
}

function minimax(board, depth, alpha, beta, maximizing) {
  if (depth === 0 || Date.now() - startTime > maxTime) {
    return evaluate(board);
  }

  const side = maximizing ? "white" : "black";
  const moves = getAllMoves(board, side);
  if (moves.length === 0) {
    return maximizing ? -100000 : 100000;
  }

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const newBoard = makeMoveCopy(board, move);
      const eval = minimax(newBoard, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, eval);
      alpha = Math.max(alpha, eval);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const newBoard = makeMoveCopy(board, move);
      const eval = minimax(newBoard, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, eval);
      beta = Math.min(beta, eval);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

// Обработка сообщений от основного потока
self.onmessage = function (e) {
  const { board: b, currentPlayer: cp, aiLevel: level } = e.data;
  board = b;
  currentPlayer = cp;
  aiLevel = level;
  maxDepth = level === 5 ? 7 : level === 4 ? 5 : level + 1;
  maxTime = level === 5 ? 30000 : level === 4 ? 5000 : 3000;
  startTime = Date.now();

  // Итеративное углубление
  let bestMove = null;
  for (let depth = 1; depth <= maxDepth; depth++) {
    if (Date.now() - startTime > maxTime) break;
    const moves = getAllMoves(board, currentPlayer);
    let bestValue = currentPlayer === "white" ? -Infinity : Infinity;
    for (const move of moves) {
      if (Date.now() - startTime > maxTime) break;
      const newBoard = makeMoveCopy(board, move);
      const value = minimax(
        newBoard,
        depth - 1,
        -Infinity,
        Infinity,
        currentPlayer !== "white"
      );
      if (currentPlayer === "white" ? value > bestValue : value < bestValue) {
        bestValue = value;
        bestMove = move;
      }
    }
  }

  // Отправляем лучший ход обратно
  self.postMessage({ bestMove });
};
