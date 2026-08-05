const express = require('express');
const rateLimit = require('express-rate-limit');
const scanController = require('../controllers/scanController');

const router = express.Router();

// Pure identity lookup, no auth required (a supervisor may scan before
// their session context is otherwise relevant), but rate-limited since an
// unauthenticated endpoint keyed on a guessable-length token is a natural
// brute-force target.
const scanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many scan attempts from this IP, please try again after 15 minutes' },
});

router.get('/:qr_token', scanLimiter, scanController.resolveByToken);

module.exports = router;
