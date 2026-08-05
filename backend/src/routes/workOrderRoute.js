const express = require('express');
const workOrderController = require('../controllers/workOrderController');
const validate = require('../middlewares/validate');
const workOrderValidation = require('../validations/workOrderValidation');
const auth = require('../middlewares/auth');

const router = express.Router();

router
  .route('/')
  .post(auth(['admin']), validate(workOrderValidation.createWorkOrder), workOrderController.createWorkOrder)
  .get(auth(['admin', 'supervisor']), validate(workOrderValidation.getWorkOrders), workOrderController.getWorkOrders);

router
  .route('/:id')
  .get(auth(['admin', 'supervisor']), validate(workOrderValidation.getWorkOrder), workOrderController.getWorkOrder)
  .patch(auth(['admin']), validate(workOrderValidation.updateWorkOrder), workOrderController.updateWorkOrder)
  .delete(auth(['admin']), validate(workOrderValidation.deleteWorkOrder), workOrderController.deleteWorkOrder);

module.exports = router;
