
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
  placementDone: false,
  placedShips: {},
  selectedShip: 0,
  orientation: 'h',
  hoverCells: []
};


// placeShipsRandom(state.playerGrid, SHIPS);

// placeShipsRandom(state.enemyGrid, SHIPS);

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
  socket.on('waitingForPlacement', () => {
  initPlacement();
});

socket.on('gameStart', () => {
  showBattle();
  updateStatus('Game started! Waiting for your turn...');
});

socket.on('waitingForOpponent', () => {
  updateStatus('Waiting for opponent to place their gators...');
});

socket.on('opponentDisconnected', () => {
  state.gameOver = true;
  updateStatus('💀 Opponent disconnected. You win!');
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

function getPreviewCells(row, col, size, horizontal) {
  const cells = [];
  for (let i = 0; i < size; i++) {
    cells.push(horizontal ? {r: row, c: col + i} : {r: row + i, c: col});
  }
  return cells;
}

function getPlacementCell(r, c) {
  const board = document.getElementById('placement-board');
  return board ? board.querySelector(`[data-row="${r}"][data-col="${c}"]`) : null;
}

function initPlacement() {
  document.getElementById('placement-section').style.display = 'block';
  document.getElementById('battle-section').style.display = 'none';
  buildShipSelector();
  renderPlacementBoard();
  updateStatus(`Placing:${SHIPS[0].name} (${SHIPS[0].size} tiles) - R to rotate`);
}

function buildShipSelector() {
  const el = document.getElementById('ship-selector');
  if(!el) return;
  el.innerHTML = '';
  SHIPS.forEach((ship,i) => {
    const btn = document.createElement('button');
    btn.id = `ship-btn-${i}`;
    btn.className = 'ship-btn' + (i === 0 ? ' selected' :'');
    btn.textContent = `${ship.name} (${ship.size})`;
    btn.onclick = () => selectShip(i);
    el.appendChild(btn);
  });
}

function selectShip(index) {
  if (state.placedShips[index] !== undefined) return;
  state.selectedShip = index;
  document.querySelectorAll('.ship-btn').forEach((btn, i) => {
    btn.classList.toggle('selected', i === index);
  });
  const ship = SHIPS[index];
  const orient = state.orientation === 'h' ? 'horizontal' : 'vertical';
  updateStatus(`Placing: ${ship.name} (${ship.size} tiles, ${orient}) - R to rotate`);
}

function toggleOrientation() {
  state.orientation = state.orientation === 'h' ? 'v' : 'h';
  clearHover();
  if (state.selectedShip !==null && state.placedShips[state.selectedShip] === undefined) {
    selectShip(state.selectedShip);
  }
}

function renderPlacementBoard() {
  const boardEl = document.getElementById('placement-board');
  if (!boardEl) return;
  boardEl.innerHTML = '';

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.row = r;
      cell.dataset.col = c;

      if (state.playerGrid[r][c] === 'ship') cell.classList.add('ship');

      cell.addEventListener('click', () => placementClick(r, c));
      cell.addEventListener('mouseenter', () => placementHover(r, c));
      cell.addEventListener('mouseleave', () => clearHover());
      boardEl.appendChild(cell);
    }
  }
}

function placementHover(row, col) {
  clearHover();
  const ship = SHIPS[state.selectedShip];
  if (!ship || state.placedShips[state.selectedShip] !== undefined) return;

  const horizontal = state.orientation === 'h';
  const cells = getPreviewCells(row,col,ship.size,horizontal);
  const valid = canPlace(state.playerGrid, row, col, ship.size, horizontal);

  state.hoverCells = cells;
  for (const {r,c} of cells) {
    const el = getPlacementCell(r,c);
    if (el) el.classList.add(valid ? 'preview-valid' : 'preview-invalid');
  }
}

function placementClick(row, col) {
  const ship = SHIPS[state.selectedShip];
  if (!ship || state.placedShips[state.selectedShip] !== undefined) return;

  const horizontal = state.orientation === 'h';
  if (!canPlace(state.playerGrid, row, col, ship.size, horizontal)) return;

  const cells = getPreviewCells(row, col, ship.size, horizontal);
  state.placedShips[state.selectedShip] = cells;
  for (const {r,c} of cells) state.playerGrid[r][c] = 'ship';

  const btn = document.getElementById(`ship-btn-${state.selectedShip}`);
  if (btn) { btn.classList.add('placed'); btn.classList.remove('selected')};

  const next = SHIPS.findIndex((_, i) => state.placedShips[i] === undefined);
  if (next !== -1) {
    selectShip(next);
  } else {
    state.selectedShip = null;
    updateStatus('All gators placed! Click READY FOR BATTLE 🐊');
    document.getElementById('ready-btn').disabled = false;
  }

  renderPlacementBoard();
}

function resetPlacement() {
  state.playerGrid = createGrid();
  state.placedShips = {};
  state.selectedShip = 0;
  state.orientation = 'h';
  SHIPS.forEach((_, i) => {
    const btn = document.getElementById(`ship-btn-${i}`);
    if (btn) btn.classList.remove('placed', 'selected');
  });
  document.getElementById('ready-btn').disabled = true;
  selectShip(0);
  renderPlacementBoard();
}

function readyUp() {
  state.placementDone = true;

  const allCells = [];
  Object.values(state.placedShips).forEach(cells => {
    cells.forEach(({r,c}) => allCells.push([r, c]));
  });

  socket.emit('placeShips', {ships: allCells });

  document.getElementById('ready-btn').disabled = true;
  updateStatus('Waiting for opponent to place their gators...');
}

function showBattle() {
  state.placementDone = true;
  document.getElementById('placement-section').style.display = 'none';
  document.getElementById('battle-section').style.display = 'block';

  renderBoard('enemy-board', state.enemyGrid, false);
  renderBoard('player-board', state.playerGrid, true);
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

function clearHover() {
  for (const {r, c} of state.hoverCells) {
    const el = getPlacementCell(r, c);
    if (el) el.classList.remove('preview-valid', 'preview-invalid');
  }
  state.hoverCells = [];
}