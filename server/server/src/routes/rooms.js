const express = require('express');
const { createRoom, roomExists, getRoom } = require('../rooms');

const router = express.Router();

// Called when someone lands on the site with no code - makes a fresh room.
router.post('/', (req, res) => {
  const code = createRoom();
  res.json({ code });
});

// Called when someone opens a link/typed-in code, to check it's real before
// opening a WebSocket and to get the current state on first paint.
router.get('/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  if (!roomExists(code)) {
    return res.status(404).json({ error: 'Room not found' });
  }
  const room = getRoom(code);
  res.json({ code, perks: room.perks, updatedAt: room.updatedAt });
});

module.exports = router;
