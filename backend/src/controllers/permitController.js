const permitService = require('../services/permitService');

// Shared error-message -> HTTP status mapping (was duplicated between
// openPermit and exitPermit with slightly inconsistent substring checks).
const mapErrorStatus = (message) => {
  if (message.includes('not authorized') || message.includes('not match')) return 403;
  if (message.includes('not found')) return 404;
  if (
    message.includes('status is currently') ||
    message.includes('Current status is') ||
    message.includes('upload is required')
  ) {
    return 400;
  }
  return null;
};

const handleServiceError = (error, res, next) => {
  const status = mapErrorStatus(error.message);
  if (status) {
    return res.status(status).json({ message: error.message });
  }
  next(error);
};

const openPermit = async (req, res, next) => {
  try {
    const supervisorId = req.user.id;
    // req.body strings are parsed, req.file has the photo
    const result = await permitService.openPermit(supervisorId, req.body, req.file);
    res.status(201).json(result);
  } catch (error) {
    handleServiceError(error, res, next);
  }
};

const exitPermit = async (req, res, next) => {
  try {
    const supervisorId = req.user.id;
    const result = await permitService.exitPermit(supervisorId, req.body, req.file);
    res.json(result);
  } catch (error) {
    handleServiceError(error, res, next);
  }
};

const resolvePermit = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const result = await permitService.resolvePermit(req.params.id, req.body.admin_resolution_note, adminId);
    res.json(result);
  } catch (error) {
    handleServiceError(error, res, next);
  }
};

const getPermitByWorkOrder = async (req, res, next) => {
  try {
    const result = await permitService.getPermitByWorkOrder(req.params.workOrderId);
    res.json(result);
  } catch (error) {
    handleServiceError(error, res, next);
  }
};

module.exports = {
  openPermit,
  exitPermit,
  resolvePermit,
  getPermitByWorkOrder,
};
