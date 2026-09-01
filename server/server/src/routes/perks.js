const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const CATALOG_PATH = path.join(__dirname, '..', '..', 'public', 'perks', 'perks.json');

router.get('/', (req, res) => {
  fs.readFile(CATALOG_PATH, 'utf8', (err, data) => {
    if (err) return res.json([]);
    try {
      res.json(JSON.parse(data));
    } catch {
      res.json([]);
    }
  });
});

module.exports = router;
