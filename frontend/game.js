
const GRID_ROWS = 2;
const GRID_COLS = 7;

const SHIPS = [
  { name: 'Big Gator',    size: 3 },
  { name: 'Medium Gator', size: 2 },
  { name: 'Baby Gator',   size: 1 },
];

const state = {
  enemyGrid:  createGrid(),
  playerGrid: createGrid(),
  gameOver:   false,
  myTurn:     false, 
};

placeShipsRandom(state.playerGrid, SHIPS);

placeShipsRandom(state.enemyGrid, SHIPS);

let socket = null;
try {
  socket = io();

  socket.on('incomingAttack', ({ row, col }) => {
    handleIncomingAttack(row, col);
  });

  socket.on('attackResult', ({ row, col, result }) => {
    applyAttackResult(state.enemyGrid, row, col, result);
    renderBoard('enemy-board', state.enemyGrid, false);
    updateStatus(result === 'hit'  ? '💥 Hit! Go again!'   :
                 result === 'sunk' ? '☠️ Sunk! Go again!'  : '🌊 Miss! Opponent\'s turn.');
  });

  socket.on('yourTurn', () => {
    state.myTurn = true;
    updateStatus('click a cell to defloat a sasegator!');
  });

  socket.on('hardwareAttack', ({ row, col }) => {
    if (state.myTurn && !state.gameOver) {
      fireAt(row, col);
    }
  });

  socket.on('gameOver', ({ winner }) => {
    state.gameOver = true;
    updateStatus(winner === 'player' ? '🎉 YOU WIN!' : '💀 You lose...');
  });

} catch (e) {
  console.warn('Socket.io not connected – running in local demo mode');
}

function createGrid() {
  return Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
}

function placeShipsRandom(grid, ships) {
  for (const ship of ships) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 200) {
      attempts++;
      const horizontal = Math.random() < 0.5;
      const row = Math.floor(Math.random() * GRID_ROWS);
      const col = Math.floor(Math.random() * GRID_COLS);

      if (canPlace(grid, row, col, ship.size, horizontal)) {
        for (let i = 0; i < ship.size; i++) {
          if (horizontal) grid[row][col + i] = 'ship';
          else            grid[row + i][col] = 'ship';
        }
        placed = true;
      }
    }
  }
}

function canPlace(grid, row, col, size, horizontal) {
  for (let i = 0; i < size; i++) {
    const r = horizontal ? row       : row + i;
    const c = horizontal ? col + i   : col;
    if (r >= GRID_ROWS || c >= GRID_COLS) return false;
    if (grid[r][c] !== null)              return false;
  }
  return true;
}
function fireAt(row, col) {
  const cell = state.enemyGrid[row][col];
  if (cell === 'hit' || cell === 'miss' || cell === 'sunk') return;
  if (!state.myTurn || state.gameOver) return;

  if (socket) {
    socket.emit('attack', { row, col });
  } else {
    const result = resolveAttack(state.enemyGrid, row, col);
    applyAttackResult(state.enemyGrid, row, col, result);
    renderBoard('enemy-board', state.enemyGrid, false);
    updateStatus(result === 'hit'  ? '💥 Hit!'   :
                 result === 'sunk' ? '☠️ Sunk!'  : '🌊 Miss!');
    checkWin();
  }
}

function resolveAttack(grid, row, col) {
  if (grid[row][col] === 'ship') {
    grid[row][col] = 'hit';
    return 'hit';
  }
  return 'miss';
}

function applyAttackResult(grid, row, col, result) {
  if (result === 'hit' || result === 'sunk') {
    grid[row][col] = result;
  } else {
    grid[row][col] = 'miss';
  }
}

function handleIncomingAttack(row, col) {
  const result = resolveAttack(state.playerGrid, row, col);
  applyAttackResult(state.playerGrid, row, col, result);
  renderBoard('player-board', state.playerGrid, true);
  if (socket) socket.emit('attackResult', { row, col, result });
  checkLoss();
}

function checkWin() {
  const allSunk = !state.enemyGrid.flat().includes('ship');
  if (allSunk) { state.gameOver = true; updateStatus('🎉 YOU WIN! All gators sunk!'); }
}

function checkLoss() {
  const allSunk = !state.playerGrid.flat().includes('ship');
  if (allSunk) { state.gameOver = true; updateStatus('💀 Your fleet is sunk! Game over.'); }
}

function renderBoard(boardId, grid, isPlayer) {
  const boardEl = document.getElementById(boardId);
  boardEl.innerHTML = '';

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.row = r;
      cell.dataset.col = c;

      const val = grid[r][c];
      if (val === 'hit')  cell.classList.add('hit');
      if (val === 'miss') cell.classList.add('miss');
      if (val === 'sunk') cell.classList.add('sunk');
      if (isPlayer && val === 'ship') cell.classList.add('ship');

      if (!isPlayer) {
        cell.addEventListener('click', () => fireAt(r, c));
      }

      boardEl.appendChild(cell);
    }
  }
}

function updateStatus(msg) {
  const el = document.getElementById('status-msg');
  if (el) {
    el.textContent = msg;
    el.style.transform = 'scale(1.1)';
    setTimeout(() => { el.style.transform = 'scale(1)'; }, 200);
  }
}

renderBoard('enemy-board',  state.enemyGrid,  false);
renderBoard('player-board', state.playerGrid, true);
updateStatus('click a cell to defloat a sasegator');
