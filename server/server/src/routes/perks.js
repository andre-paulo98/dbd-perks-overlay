const express = require('express');

// getCatalog is a function rather than the array itself, since the array
// reference gets replaced wholesale each time the catalog is refetched -
// a function always reads the current one.
module.exports = function perksRouter(getCatalog) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(getCatalog());
  });

  return router;
};
