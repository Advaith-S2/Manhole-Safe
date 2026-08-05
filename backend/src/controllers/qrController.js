const archiver = require('archiver');
const qrService = require('../services/qrService');

const generateForManhole = async (req, res, next) => {
  try {
    const manholeId = parseInt(req.params.manholeId, 10);
    const svg = await qrService.generateLabelForManhole(manholeId);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="manhole-${manholeId}-qr-label.svg"`);
    res.send(svg);
  } catch (error) {
    if (error.message === 'Manhole not found.') {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

// Bulk export: one ZIP containing a printable label per manhole. There is no
// separate "has this manhole's QR been rendered before" flag to check against
// — qr_token always exists once a manhole row exists (enforced NOT NULL), and
// rendering the label is a cheap stateless operation, so bulk export simply
// (re)generates the full set on each call rather than tracking asset state.
const generateBulk = async (req, res, next) => {
  try {
    const labels = await qrService.generateLabelsForAllManholes();

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="manhole-qr-labels.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => next(err));
    archive.pipe(res);

    for (const label of labels) {
      archive.append(label.svg, { name: `${label.qr_code_id}-qr-label.svg` });
    }

    await archive.finalize();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateForManhole,
  generateBulk,
};
