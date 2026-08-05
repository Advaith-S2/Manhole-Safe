const publicService = require('../services/publicService');

const confirmPermit = async (req, res, next) => {
  try {
    const { token } = req.params;
    const result = await publicService.confirmPermit(token);
    res.json(result);
  } catch (error) {
    if (error.message.includes('Invalid or expired')) {
      res.status(401).json({ message: error.message });
    } else if (error.message.includes('already been confirmed')) {
      res.status(409).json({ message: error.message }); // Conflict
    } else if (error.message.includes('not found')) {
      res.status(404).json({ message: error.message });
    } else {
      res.status(400).json({ message: error.message });
    }
  }
};

const getPermitPreview = async (req, res, next) => {
  try {
    const { token } = req.params;
    const result = await publicService.getPermitPreview(token);
    res.json(result);
  } catch (error) {
    if (error.alreadyConfirmed) {
      res.status(409).json({ message: error.message, confirmed_at: error.confirmedAt });
    } else if (error.message.includes('Invalid or expired') || error.message.includes('Invalid confirmation token')) {
      res.status(401).json({ message: error.message });
    } else if (error.message.includes('not found')) {
      res.status(404).json({ message: error.message });
    } else {
      res.status(400).json({ message: error.message });
    }
  }
};

module.exports = {
  confirmPermit,
  getPermitPreview,
};
