const workOrderService = require('../services/workOrderService');

// Central place to map known service-layer error messages to HTTP status
// codes, instead of repeating the same if/else chain in every handler.
const mapErrorStatus = (message) => {
  if (message === 'Work Order not found') return 404;
  if (message.includes('already exists')) return 409;
  if (message.includes('does not reference an existing')) return 400;
  return null;
};

const handleServiceError = (error, res, next) => {
  const status = mapErrorStatus(error.message);
  if (status) {
    return res.status(status).json({ message: error.message });
  }
  next(error);
};

const createWorkOrder = async (req, res, next) => {
  try {
    const workOrder = await workOrderService.createWorkOrder(req.body);
    res.status(201).json(workOrder);
  } catch (error) {
    handleServiceError(error, res, next);
  }
};

const getWorkOrders = async (req, res, next) => {
  try {
    const { status, limit, page } = req.query;
    const filter = { status, limit, page };
    // A supervisor only ever sees their own work orders. This is forced from
    // the authenticated token's id, never taken from client input — the
    // query schema doesn't even accept a supervisor_id param, so there is no
    // client-supplied value that could override this.
    if (req.user.role === 'supervisor') {
      filter.supervisor_id = req.user.id;
    }
    const workOrders = await workOrderService.getWorkOrders(filter);
    res.json(workOrders);
  } catch (error) {
    next(error);
  }
};

const getWorkOrder = async (req, res, next) => {
  try {
    const workOrder = await workOrderService.getWorkOrderById(req.params.id);
    if (req.user.role === 'supervisor' && workOrder.supervisor_id !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to view this work order.' });
    }
    res.json(workOrder);
  } catch (error) {
    handleServiceError(error, res, next);
  }
};

const updateWorkOrder = async (req, res, next) => {
  try {
    const workOrder = await workOrderService.updateWorkOrderById(req.params.id, req.body);
    res.json(workOrder);
  } catch (error) {
    handleServiceError(error, res, next);
  }
};

const deleteWorkOrder = async (req, res, next) => {
  try {
    await workOrderService.deleteWorkOrderById(req.params.id);
    res.status(204).send();
  } catch (error) {
    handleServiceError(error, res, next);
  }
};

module.exports = {
  createWorkOrder,
  getWorkOrders,
  getWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
};
