const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.json());

// ── Game state ────────────────────────────────
const players    = {};  // { socketId: 'player1' | 'player2' }
const shipData   = {};  // { 'player1': [[r,c],...], 'player2': [[r,c],...] }
const readyState = {};  // { 'player1': true/false, 'player2': true/false }
let   gameActive = false;
let   turn       = 'player1';

// ── Helpers ───────────────────────────────────
function getId(role) {
  return Object.keys(players).find(id => players[id] === role);
}

function bothReady() {
  return readyState['player1'] === true && readyState['player2'] === true;
}

// ── Connection ────────────────────────────────
io.on('connection', (socket) => {

  const takenRoles = Object.values(players);
  if (!takenRoles.includes('player1')) {
    players[socket.id] = 'player1';
    readyState['player1'] = false;
    console.log(`Player 1 connected: ${socket.id}`);
    socket.emit('assignRole', { role: 'player1' });
    socket.emit('waitingForPlacement');
  } else if (!takenRoles.includes('player2')) {
    players[socket.id] = 'player2';
    readyState['player2'] = false;
    console.log(`Player 2 connected: ${socket.id}`);
    socket.emit('assignRole', { role: 'player2' });
    socket.emit('waitingForPlacement');
  } else {
    console.log(`Spectator connected: ${socket.id}`);
    return;
  }

  // ── Ship placement ────────────────────────
  // Frontend emits: socket.emit('placeShips', { ships: [[r,c],[r,c],...] })
  // ships = every cell occupied by any ship
  socket.on('placeShips', ({ ships }) => {
    const role = players[socket.id];
    if (!role) return;

    shipData[role] = ships;
    readyState[role] = true;
    console.log(`${role} placed ships:`, ships);

    const otherRole = role === 'player1' ? 'player2' : 'player1';
    const otherId   = getId(otherRole);
    if (otherId) io.to(otherId).emit('opponentReady');

    if (bothReady()) {
      gameActive = true;
      turn = 'player1';
      console.log('Both players ready — game starting!');
      io.emit('gameStart');
      const p1Id = getId('player1');
      if (p1Id) io.to(p1Id).emit('yourTurn');
    } else {
      socket.emit('waitingForOpponent');
    }
  });

  // ── Attack ────────────────────────────────
  socket.on('attack', ({ row, col }) => {
    const role = players[socket.id];
    if (!gameActive)   return;
    if (role !== turn) return;

    const targetRole = role === 'player1' ? 'player2' : 'player1';
    const targetId   = getId(targetRole);
    if (targetId) {
      io.to(targetId).emit('incomingAttack', { row, col });
    }
  });

  // ── Attack result ─────────────────────────
  socket.on('attackResult', ({ row, col, result }) => {
    const defenderRole = players[socket.id];
    const attackerRole = defenderRole === 'player1' ? 'player2' : 'player1';
    const attackerId   = getId(attackerRole);

    if (attackerId) {
      io.to(attackerId).emit('attackResult', { row, col, result });
    }

    if (result === 'hit' || result === 'sunk') {
      const keepId = getId(attackerRole);
      if (keepId) io.to(keepId).emit('yourTurn');
      console.log(`${attackerRole} hit! They go again.`);
    } else {
      turn = defenderRole;
      const nextId = getId(turn);
      if (nextId) io.to(nextId).emit('yourTurn');
      console.log(`${attackerRole} missed. ${turn}'s turn now.`);
    }
  });

  // ── Disconnect ────────────────────────────
  socket.on('disconnect', () => {
    const role = players[socket.id];
    console.log(`Disconnected: ${socket.id} (${role})`);

    if (gameActive && role) {
      const otherRole = role === 'player1' ? 'player2' : 'player1';
      const otherId   = getId(otherRole);
      if (otherId) io.to(otherId).emit('opponentDisconnected');
    }

    delete players[socket.id];
    if (role) {
      delete readyState[role];
      delete shipData[role];
    }

    gameActive = false;
    turn = 'player1';
  });
});

// ── Hardware attack (Arduino POST) ───────────
app.post('/hardware-attack', (req, res) => {
  const { row, col } = req.body;
  if (row === undefined || col === undefined) {
    return res.status(400).json({ error: 'Missing row or col' });
  }

  const r = parseInt(row);
  const c = parseInt(col);
  if (r < 0 || r > 1 || c < 0 || c > 6) {
    return res.status(400).json({ error: 'Out of bounds (grid is 2x7)' });
  }

  if (!gameActive) {
    return res.status(400).json({ error: 'Game not active yet' });
  }

  console.log(`Hardware attack: row=${r}, col=${c} — routing to ${turn}`);
  const currentId = getId(turn);
  if (currentId) io.to(currentId).emit('hardwareAttack', { row: r, col: c });

  res.json({ ok: true, row: r, col: c, firedFor: turn });
});

server.listen(PORT, () => {
  console.log(`\n BattleGator server running at http://localhost:${PORT}\n`);
});