const express = require('express');
const permitController = require('../controllers/permitController');
const validate = require('../middlewares/validate');
const permitValidation = require('../validations/permitValidation');
const auth = require('../middlewares/auth');
const upload = require('../utils/upload');

const router = express.Router();

router.post(
  '/open',
  auth(['supervisor']),
  upload.single('photo'),
  validate(permitValidation.openPermit),
  permitController.openPermit
);

router.post(
  '/exit',
  auth(['supervisor']),
  upload.single('photo'),
  validate(permitValidation.exitPermit),
  permitController.exitPermit
);

// Read-only permit lookup by work order id, for the admin ledger detail panel
// and the supervisor's own ticket (live status, timers, GPS-mismatch flag,
// SMS history). Previously the only way to see a PermitEntry was the
// response of the open/exit calls that created it.
router.get(
  '/by-work-order/:workOrderId',
  auth(['admin', 'supervisor']),
  permitController.getPermitByWorkOrder
);

// Previously permitValidation.resolvePermit existed with no matching route,
// so escalated/unconfirmed permits had no way to ever be closed by an admin.
router.post(
  '/:id/resolve',
  auth(['admin']),
  validate(permitValidation.resolvePermit),
  permitController.resolvePermit
);

module.exports = router;
