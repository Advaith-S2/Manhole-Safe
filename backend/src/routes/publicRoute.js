const express = require('express');
const rateLimit = require('express-rate-limit');
const publicController = require('../controllers/publicController');

const router = express.Router();

// Apply rate limiting to public routes
const confirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per `window` (here, per 15 minutes)
  message: { message: 'Too many confirmation attempts from this IP, please try again after 15 minutes' }
});

router.get('/permit/confirm/:token', confirmLimiter, publicController.getPermitPreview);
router.post('/permit/confirm/:token', confirmLimiter, publicController.confirmPermit);

module.exports = router;
