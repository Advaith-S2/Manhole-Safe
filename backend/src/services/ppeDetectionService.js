const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

// Calls a local YOLO-World inference service (ppe-service/) instead of a
// hosted API. Deliberately not Roboflow's cloud endpoint: a per-call-billed
// hosted API is a live-demo failure mode (credits can run out mid-pitch,
// and it adds a hard dependency on venue wifi for one specific feature).
// This process runs entirely on-machine once its model weights are cached,
// so PPE detection has no network dependency at demo time.
const PPE_SERVICE_URL = process.env.PPE_SERVICE_URL || 'http://localhost:8000';

// PPE verification is advisory only, matching the existing GPS-mismatch
// pattern: a low-confidence or negative detection is recorded and surfaced
// to admins, but never blocks permit opening. A worker physically at the
// manhole must still be able to start work even if the local service is
// down or slow.
const detectPpe = async (photoPath) => {
  try {
    const imageBuffer = fs.readFileSync(photoPath);
    const filename = path.basename(photoPath);

    const form = new FormData();
    form.append('file', new Blob([imageBuffer]), filename);

    const res = await fetch(`${PPE_SERVICE_URL}/detect`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const predictions = Array.isArray(data.predictions) ? data.predictions : [];

    return {
      ppe_verified: Boolean(data.ppe_verified),
      ppe_detection_result: {
        predictions,
        model: data.model || 'yolo-world (local)',
        checked_at: new Date().toISOString(),
      },
      skipped: false,
    };
  } catch (error) {
    // Covers: service not running, timeout, bad response. Never blocks
    // permit opening — just records that the check didn't happen.
    logger.warn(`[PPE Detection] Local inference call failed: ${error.message}`);
    return {
      ppe_verified: false,
      ppe_detection_result: { error: error.message, checked_at: new Date().toISOString() },
      skipped: false,
    };
  }
};

module.exports = { detectPpe };
