// In-memory room store. Ephemeral by design - rooms are lobby codes for a
// single play session, not something that needs to survive a server restart.

const rooms = new Map(); // code -> { perks: [4], updatedAt, lastActivity }

// Avoids visually ambiguous characters (0/O, 1/I/L) since people will be
// reading these codes off a screen or typing them into Discord mid-game.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode(length = 5) {
  let code;
  do {
    code = '';
    for (let i = 0; i < length; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
  } while (rooms.has(code));
  return code;
}

function createRoom() {
  const code = generateCode();
  rooms.set(code, {
    perks: [null, null, null, null],
    updatedAt: Date.now(),
    lastActivity: Date.now(),
  });
  return code;
}

function roomExists(code) {
  return rooms.has(code);
}

function getRoom(code) {
  const room = rooms.get(code);
  if (room) room.lastActivity = Date.now();
  return room;
}

function setPerks(code, perks) {
  const room = rooms.get(code);
  if (!room) return false;
  room.perks = [0, 1, 2, 3].map((i) => perks[i] || null);
  room.updatedAt = Date.now();
  room.lastActivity = Date.now();
  return true;
}

function setPerk(code, index, value) {
  const room = rooms.get(code);
  if (!room) return false;
  room.perks[index - 1] = value || null;
  room.updatedAt = Date.now();
  room.lastActivity = Date.now();
  return true;
}

function clearPerks(code) {
  const room = rooms.get(code);
  if (!room) return false;
  room.perks = [null, null, null, null];
  room.updatedAt = Date.now();
  room.lastActivity = Date.now();
  return true;
}

// Sweep rooms nobody has touched in 6 hours, checked every 30 minutes.
// Prevents unbounded memory growth on a long-running server.
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 30 * 60 * 1000;

function startCleanupSweep() {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (now - room.lastActivity > ROOM_TTL_MS) rooms.delete(code);
    }
  }, SWEEP_INTERVAL_MS);
  timer.unref(); // don't keep the process alive just for this timer
  return timer;
}

module.exports = {
  createRoom,
  roomExists,
  getRoom,
  setPerks,
  setPerk,
  clearPerks,
  startCleanupSweep,
};
