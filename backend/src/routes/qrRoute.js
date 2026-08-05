const express = require('express');
const qrController = require('../controllers/qrController');
const auth = require('../middlewares/auth');

const router = express.Router();

router.get('/manhole/:manholeId', auth(['admin']), qrController.generateForManhole);
router.get('/bulk', auth(['admin']), qrController.generateBulk);

module.exports = router;
