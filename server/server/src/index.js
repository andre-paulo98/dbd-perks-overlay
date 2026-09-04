const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const {
  roomExists,
  getRoom,
  setPerks,
  setPerk,
  clearPerks,
  startCleanupSweep,
} = require('./rooms');
const { loadPerksCatalog } = require('./perksCatalog');

const app = express();
app.use(express.json());
app.use('/perks', express.static(path.join(__dirname, '..', 'public', 'perks')));
app.use('/api/rooms', require('./routes/rooms'));

let perksCatalog = [];
app.use('/api/perks', require('./routes/perks')(() => perksCatalog));

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// room code -> Set<WebSocket>. Everyone in a room - browser tabs and
// Rainmeter clients alike - lives in the same set and gets the same broadcasts.
const roomSockets = new Map();

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== '/ws') {
    socket.destroy();
    return;
  }

  const code = (url.searchParams.get('room') || '').toUpperCase();
  if (!code || !roomExists(code)) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, code);
  });
});

wss.on('connection', (ws, code) => {
  if (!roomSockets.has(code)) roomSockets.set(code, new Set());
  roomSockets.get(code).add(ws);

  // Heartbeat bookkeeping - see the setInterval below.
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // New joiners (including a Rainmeter client that just connected) get the
  // current picture immediately, without waiting for someone else to edit.
  send(ws, stateMessage(code));

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return; // ignore anything that isn't valid JSON
    }

    switch (msg.type) {
      case 'setPerks':
        if (Array.isArray(msg.perks) && setPerks(code, msg.perks)) {
          broadcast(code);
        }
        break;

      case 'setPerk':
        if (
          Number.isInteger(msg.index) &&
          msg.index >= 1 &&
          msg.index <= 4 &&
          setPerk(code, msg.index, msg.value)
        ) {
          broadcast(code);
        }
        break;

      case 'clear':
        if (clearPerks(code)) {
          broadcast(code);
        }
        break;

      default:
        break; // unknown message type, ignore
    }
  });

  ws.on('close', () => {
    const set = roomSockets.get(code);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) roomSockets.delete(code);
  });
});

function stateMessage(code) {
  const room = getRoom(code);
  return JSON.stringify({
    type: 'state',
    code,
    perks: room.perks,
    updatedAt: room.updatedAt,
  });
}

function send(ws, data) {
  if (ws.readyState === ws.OPEN) ws.send(data);
}

function broadcast(code) {
  const set = roomSockets.get(code);
  if (!set) return;
  const data = stateMessage(code);
  for (const ws of set) send(ws, data);
}

// Reverse proxies (nginx, and often whatever sits in front of it too)
// default to closing a WebSocket connection after ~60s of no traffic -
// and since we only ever push data when perks actually change, a quiet
// lobby would otherwise get disconnected and reconnected on a loop. A
// ping every 25s keeps real bytes flowing well under that window. This
// also doubles as dead-connection cleanup: a client that doesn't
// respond to one ping gets terminated on the next round rather than
// lingering as a zombie entry in roomSockets.
const HEARTBEAT_INTERVAL_MS = 25000;
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_INTERVAL_MS);
heartbeat.unref(); // don't keep the process alive just for this timer

startCleanupSweep();

const PORT = process.env.PORT || 3001;

async function start() {
  perksCatalog = await loadPerksCatalog();
  server.listen(PORT, () => {
    console.log(`DBD perk sync server listening on :${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
