
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

const players = {}; // { socketId: 'player1' | 'player2' }
let   turn    = 'player1';

io.on('connection', (socket) => {

  const takenRoles = Object.values(players);
  if (!takenRoles.includes('player1')) {
    players[socket.id] = 'player1';
    console.log(`Player 1 connected: ${socket.id}`);
    socket.emit('yourTurn'); 
  } else if (!takenRoles.includes('player2')) {
    players[socket.id] = 'player2';
    console.log(`Player 2 connected: ${socket.id}`);
  } else {
    console.log(`Spectator connected: ${socket.id}`);
  }

  socket.on('attack', ({ row, col }) => {
    const role = players[socket.id];
    if (role !== turn) return; 

    const targetRole = role === 'player1' ? 'player2' : 'player1';
    const targetId   = Object.keys(players).find(id => players[id] === targetRole);

    if (targetId) {
      io.to(targetId).emit('incomingAttack', { row, col });
    }
  });

  socket.on('attackResult', ({ row, col, result }) => {
    const defenderRole = players[socket.id];
    const attackerRole = defenderRole === 'player1' ? 'player2' : 'player1';
    const attackerId   = Object.keys(players).find(id => players[id] === attackerRole);

    if (attackerId) {
      io.to(attackerId).emit('attackResult', { row, col, result });
    }

    if (result === 'hit' || result === 'sunk') {
      const keepId = Object.keys(players).find(id => players[id] === attackerRole);
      if (keepId) io.to(keepId).emit('yourTurn');
      console.log(`${attackerRole} hit! They go again.`);
    } else {
      turn = defenderRole;
      const nextId = Object.keys(players).find(id => players[id] === turn);
      if (nextId) io.to(nextId).emit('yourTurn');
      console.log(`${attackerRole} missed. ${turn}'s turn now.`);
    }
  });


  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id} (${players[socket.id]})`);
    delete players[socket.id];
  });
});

app.post('/hardware-attack', (req, res) => {
  const { row, col } = req.body;
  if (row === undefined || col === undefined) {
    return res.status(400).json({ error: 'Missing row or col' });
  }

  console.log(`Hardware attack received: row=${row}, col=${col}`);

  io.emit('hardwareAttack', { row: parseInt(row), col: parseInt(col) });

  res.json({ ok: true, row, col });
});

server.listen(PORT, () => {
  console.log(`\n🐊 Gator Battleship server running at http://localhost:${PORT}\n`);
});