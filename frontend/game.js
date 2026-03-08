const GRID_ROWS = 2;
const GRID_COLS = 7;

const SHIPS = [
  { name: 'Big Gator',    size: 3 },
  { name: 'Medium Gator', size: 2 },
  { name: 'Baby Gator',   size: 1 },
];

const state = {
  enemyGrid:       createGrid(),
  playerGrid:      createGrid(),
  gameOver:        false,
  myTurn:          false,
  myRole:          null,
  placementDone:   false,
  placedShips:     {},
  selectedShip:    0,
  awaitingConfirm: false,
  hoverCells:      []
};

const SPRITE = {
  tube1: {
    idle:     'assets/Sprites/1tube_idle.gif',
    attacked: 'assets/Sprites/1tube_attacked.gif',
    end:      'assets/Sprites/1tube_ending.png',
  },
  top2: {
    idle:     'assets/Sprites/top2tube_idle.gif',
    attacked: 'assets/Sprites/top2tube_attacked.gif',
    end:      'assets/Sprites/top2tube_ending.png',
  },
  bottom2: {
    idle:     'assets/Sprites/bottom2tube_idle.gif',
    attacked: 'assets/Sprites/bottom2tube_attacked.gif',
    end:      'assets/Sprites/bottom2tube_ending.png',
  },
  left3: {
    idle:     'assets/Sprites/left3tube_gatorsprite_idle.gif',
    attacked: 'assets/Sprites/left3tube_attacked.gif',
    end:      'assets/Sprites/left3tube_ending.png',
  },
  mid3: {
    idle:     'assets/Sprites/mid3tube_gatorsprite_idle.gif',
    attacked: 'assets/Sprites/mid3tube_attacked.gif',
    end:      'assets/Sprites/mid3tube_ending.png',
  },
  right3: {
    idle:     'assets/Sprites/right3tube_gatorsprite_idle.gif',
    attacked: 'assets/Sprites/right3tube_attacked.gif',
    end:      'assets/Sprites/right3tube_ending.png',
  },
  miss: {
    anim: 'assets/Sprites/miss_animation.gif',
    end:  'assets/Sprites/miss_ending.png',
  }
};

const GIF_DURATION = {
  attacked: 1500,
  miss: 1000,
};

let socket = null;
try {
  socket = io();

  // Know which player we are
  socket.on('assignRole', ({ role }) => {
    state.myRole = role;
    console.log('Assigned role:', role);
  });

  socket.on('incomingAttack', ({ row, col }) => {
    handleIncomingAttack(row, col);
  });

//   socket.on('attackResult', ({ row, col, result }) => {
//   applyAttackResult(state.enemyGrid, row, col, result);
//   renderBoard('enemy-board', state.enemyGrid, false);
//   updateStatus(result === 'hit'  ? '💥 Hit! Go again!'  :
//                result === 'sunk' ? '☠️ Sunk! Go again!' : '🌊 Miss! Opponent\'s turn.');
//   checkWin(); 
// });

socket.on('attackResult', ({ row, col, result }) => {
  applyAttackResult(state.enemyGrid, row, col, result);
  setTimeout(() => {
    renderBoard('enemy-board', state.enemyGrid, false);
    updateStatus(result === 'hit'  ? '💥 Hit! Go again!'  :
                 result === 'sunk' ? '☠️ Sunk! Go again!' : '🌊 Miss! Opponent\'s turn.');
    checkWin();
  }, GIF_DURATION.attacked + 100);
});

socket.on('yourTurn', () => {
  if (state.gameOver) return;
  state.myTurn = true;
  updateStatus('Click a cell to defloat a SASEgator!');
});

  socket.on('hardwareAttack', ({ row, col }) => {
    if (state.myTurn && !state.gameOver) fireAt(row, col);
  });

  // winner is 'player1' or 'player2' — compare to our role
  socket.on('gameOver', ({ winner }) => {
    state.gameOver = true;
    showGameOver(winner === state.myRole);
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

// ── Grid helpers ──────────────────────────────

function createGrid() {
  return Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
}

function canPlace(grid, row, col, size, horizontal) {
  for (let i = 0; i < size; i++) {
    const r = horizontal ? row     : row + i;
    const c = horizontal ? col + i : col;
    if (r >= GRID_ROWS || c >= GRID_COLS) return false;
    if (grid[r][c] !== null)              return false;
  }
  return true;
}

function getPreviewCells(row, col, size) {
  const cells = [];
  for (let i = 0; i < size; i++) {
    cells.push({ r: row, c: col + i });
  }
  return cells;
}

function getPlacementCell(r, c) {
  const board = document.getElementById('placement-board');
  return board ? board.querySelector(`[data-row="${r}"][data-col="${c}"]`) : null;
}

// ── Sprite helpers ────────────────────────────

function buildSpriteMap() {
  const map = {};
  Object.entries(state.placedShips).forEach(([shipIndex, cells]) => {
    cells.forEach((cell, posIndex) => {
      map[`${cell.r}_${cell.c}`] = {
        shipIndex: parseInt(shipIndex),
        pos: posIndex,
        total: cells.length
      };
    });
  });
  return map;
}

function getSpriteKey(pos, total) {
  if (total === 1) return 'tube1';
  if (total === 2) return pos === 0 ? 'top2' : 'bottom2';
  if (total === 3) {
    if (pos === 0) return 'left3';
    if (pos === 1) return 'mid3';
    return 'right3';
  }
}

function getShipSprite(shipIndex, pos, total) {
  return SPRITE[getSpriteKey(pos, total)].idle;
}

function getIdleSprite(pos, total) {
  return SPRITE[getSpriteKey(pos,total)].idle;
}

function getAttackedSprite(pos, total) {
  return SPRITE[getSpriteKey(pos, total)]. attacked;
}

function getEndSprite(pos, total) {
  return SPRITE[getSpriteKey(pos,total)].end;
}

// atk gif then freeze

function playAttack(boardId, row, col, pos, total) {
  const board = document.getElementById(boardId);
  if (!board) return;
  const cell = board.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  if (!cell) return;
  cell.innerHTML = `<img src="${getAttackedSprite(pos, total)}" width="64" height="64">`;
  setTimeout(() => {
    cell.innerHTML = `<img src="${getEndSprite(pos, total)}" width="64" height="64">`;
  }, GIF_DURATION.attacked);
}

function playMiss(boardId, row, col) {
  const board = document.getElementById(boardId);
  if (!board) return;
  const cell = board.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  if (!cell) return;

  cell.innerHTML = `<img src="${SPRITE.miss.anim}" width="64" height="64">`;

  setTimeout(() => {
    cell.innerHTML = `<img src="${SPRITE.miss.end}" width="64" height="64">`;
  }, GIF_DURATION.miss);
}

// ── Placement phase ───────────────────────────

function initPlacement() {
  document.getElementById('placement-section').style.display = 'block';
  document.getElementById('battle-section').style.display = 'none';
  buildShipSelector();
  renderPlacementBoard();
  updateStatus(`Placing: ${SHIPS[0].name} (${SHIPS[0].size} tiles) — click leftmost cell`);
}

function buildShipSelector() {
  const el = document.getElementById('ship-selector');
  if (!el) return;
  el.innerHTML = '';
  SHIPS.forEach((ship, i) => {
    const btn = document.createElement('button');
    btn.id = `ship-btn-${i}`;
    btn.className = 'ship-btn' + (i === 0 ? ' selected' : '');
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
  updateStatus(`Placing: ${ship.name} (${ship.size} tiles) — click leftmost cell`);
}

function renderPlacementBoard() {
  const boardEl = document.getElementById('placement-board');
  if (!boardEl) return;
  boardEl.innerHTML = '';
  const spriteMap = buildSpriteMap();

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.row = r;
      cell.dataset.col = c;

      if (state.playerGrid[r][c] === 'ship') {
        cell.classList.add('ship');
        const sprite = spriteMap[`${r}_${c}`];
        if (sprite) {
          const src = getShipSprite(sprite.shipIndex, sprite.pos, sprite.total);
          cell.innerHTML = `<img src="${src}" width="64" height="64">`;
        }
      }

      cell.addEventListener('click',      () => placementClick(r, c));
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
  const cells = getPreviewCells(row, col, ship.size);
  const valid  = canPlace(state.playerGrid, row, col, ship.size, true);
  state.hoverCells = cells;
  for (const { r, c } of cells) {
    const el = getPlacementCell(r, c);
    if (el) el.classList.add(valid ? 'preview-valid' : 'preview-invalid');
  }
}

function placementClick(row, col) {
  if (state.awaitingConfirm) {
    readyUp();
    return;
  }

  const ship = SHIPS[state.selectedShip];
  if (!ship) return;
  if (!canPlace(state.playerGrid, row, col, ship.size, true)) return;

  const cells = getPreviewCells(row, col, ship.size);
  state.placedShips[state.selectedShip] = cells;
  for (const { r, c } of cells) state.playerGrid[r][c] = 'ship';

  const btn = document.getElementById(`ship-btn-${state.selectedShip}`);
  if (btn) { btn.classList.add('placed'); btn.classList.remove('selected'); }

  const next = SHIPS.findIndex((_, i) => state.placedShips[i] === undefined);
  if (next !== -1) {
    selectShip(next);
  } else {
    state.selectedShip    = null;
    state.awaitingConfirm = true;
    updateStatus('All gators placed! Press any button to confirm!');
    document.getElementById('ready-btn').disabled = false;
  }

  renderPlacementBoard();
}

function resetPlacement() {
  state.playerGrid      = createGrid();
  state.placedShips     = {};
  state.selectedShip    = 0;
  state.awaitingConfirm = false;
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
    cells.forEach(({ r, c }) => allCells.push([r, c]));
  });
  socket.emit('placeShips', { ships: allCells });
  document.getElementById('ready-btn').disabled = true;
  updateStatus('Waiting for opponent to place their gators...');
}

function showBattle() {
  state.placementDone = true;
  document.getElementById('placement-section').style.display = 'none';
  document.getElementById('battle-section').style.display   = 'block';
  renderBoard('enemy-board',  state.enemyGrid,  false);
  renderBoard('player-board', state.playerGrid, true);
}

// ── Battle phase ──────────────────────────────

function fireAt(row, col) {
  const cell = state.enemyGrid[row][col];
  if (cell === 'hit' || cell === 'miss' || cell === 'sunk') return;
  if (!state.myTurn || state.gameOver) return;
  state.myTurn = false; // ← lock immediately so they can't double-fire
  if (socket) {
    socket.emit('attack', { row, col });
  } else {
    const result = resolveAttack(state.enemyGrid, row, col);
    applyAttackResult(state.enemyGrid, row, col, result);
    renderBoard('enemy-board', state.enemyGrid, false);
    updateStatus(result === 'hit' ? '💥 Hit!' : '🌊 Miss!');
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

// function applyAttackResult(grid, row, col, result) {
//   grid[row][col] = (result === 'hit' || result === 'sunk') ? result : 'miss';

//   if (result === 'hit' || result === 'sunk') {
//     const boardId = (grid === state.playerGrid) ? 'player-board' : 'enemy-board';
//     const board = document.getElementById(boardId);
//     if (board) {
//       const cell = board.querySelector(`[data-row="${row}"][data-col="${col}"]`);
//       if (cell) {
//         cell.innerHTML = `<img src="assets/Sprites/top2tube_attacked.gif" width="64" height="64">`;

//         setTimeout(() => {
//           cell.innerHTML = `<img src="assets/Sprites/1tube_idle.gif" width="64" height="64">`;
//         }, 2000);
//       }
//     }
//   }
// }

function applyAttackResult(grid, row, col, result) {
  const boardId  = (grid === state.playerGrid) ? 'player-board' : 'enemy-board';
  const isPlayer = (grid === state.playerGrid);
  const spriteMap = isPlayer ? buildSpriteMap() : {};
  const sprite    = spriteMap[`${row}_${col}`];

  grid[row][col] = (result === 'hit' || result === 'sunk') ? result : 'miss';

  if (result === 'hit' || result === 'sunk') {
    if (sprite) {
      playAttack(boardId, row, col, sprite.pos, sprite.total);
    } else {
      // enemy board — no sprite map, just play miss-style flash
      const board = document.getElementById(boardId);
      const cell  = board?.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      if (cell) cell.classList.add('hit');
    }
  } else {
    playMiss(boardId, row, col);
  }
}

function handleIncomingAttack(row, col) {
  const result = resolveAttack(state.playerGrid, row, col);
  applyAttackResult(state.playerGrid, row, col, result);
  if (socket) socket.emit('attackResult', { row, col, result });
  checkLoss();
  // delay renderBoard so the gif has time to play first
  setTimeout(() => {
    renderBoard('player-board', state.playerGrid, true);
  }, GIF_DURATION.miss + 100);
}

function showGameOver(iWon) {
  const overlay = document.getElementById('gameover-overlay');
  const title   = document.getElementById('gameover-title');
  const msg     = document.getElementById('gameover-msg');
  title.textContent = iWon ? '🏆 VICTORY!'  : '💀 DEFEATED!';
  msg.textContent   = iWon
    ? 'You defloated all the gators!'
    : 'Your gators got defloated...';
  overlay.style.display = 'flex';
}

function checkWin() {
  const hits = state.enemyGrid.flat().filter(v => v === 'hit').length;
  if (hits >= 6) {
    state.gameOver = true;
    socket.emit('gameOver', { winner: state.myRole });
    showGameOver(true);
  }
}

function checkLoss() {
  if (!state.playerGrid.flat().includes('ship')) {
    state.gameOver = true;
    showGameOver(false);
  }
}



function renderBoard(boardId, grid, isPlayer) {
  const boardEl = document.getElementById(boardId);
  boardEl.innerHTML = '';
  const spriteMap = isPlayer ? buildSpriteMap() : {};

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.row = r;
      cell.dataset.col = c;

      const val = grid[r][c];

      if (val === 'hit' || val === 'sunk') {
        cell.classList.add(val);
        const sprite = spriteMap[`${r}_${c}`];
        if (sprite) {
        cell.innerHTML = `<img src="${getEndSprite(sprite.pos, sprite.total)}" width="64" height="64">`;
        }
}

      if (val === 'miss') {
        cell.classList.add('miss');
        cell.innerHTML = `<img src="${SPRITE.miss.end}" width="64" height="64">`;
      }

      if (isPlayer && val === 'ship') {
        cell.classList.add('ship');
        const sprite = spriteMap[`${r}_${c}`];
        if (sprite) {
          const src = getShipSprite(sprite.shipIndex, sprite.pos, sprite.total);
          cell.innerHTML = `<img src="${src}" width="64" height="64">`;
        }
      }

      if (!isPlayer) cell.addEventListener('click', () => fireAt(r, c));
      boardEl.appendChild(cell);
    }
  }
}

function updateStatus(msg) {
  const el = document.getElementById('status-msg');
  if (el) {
    el.textContent     = msg;
    el.style.transform = 'scale(1.1)';
    setTimeout(() => { el.style.transform = 'scale(1)'; }, 200);
  }
}

function clearHover() {
  for (const { r, c } of state.hoverCells) {
    const el = getPlacementCell(r, c);
    if (el) el.classList.remove('preview-valid', 'preview-invalid');
  }
  state.hoverCells = [];
}