const scanService = require('../services/scanService');

const resolveByToken = async (req, res) => {
  try {
    const manhole = await scanService.resolveManholeByToken(req.params.qr_token);
    res.json(manhole);
  } catch (error) {
    // Generic 404 regardless of why the lookup failed — see scanService.
    res.status(404).json({ message: 'Unrecognized code.' });
  }
};

module.exports = {
  resolveByToken,
};
