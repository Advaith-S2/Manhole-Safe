const Joi = require('joi');

const openPermit = {
  body: Joi.object().keys({
    work_order_id: Joi.number().integer().required(),
    // The raw token scanned/entered on-device. The server independently
    // resolves this to a manhole and re-runs authorization — it never trusts
    // a client-supplied manhole id, since that's exactly what would let a
    // photographed/reused QR forge its way past the check.
    qr_token: Joi.string().required(),
    worker_phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(), // Basic E.164
    emergency_contact_phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).allow(null, '').optional(),
    lat: Joi.number().allow(null).optional(),
    lng: Joi.number().allow(null).optional(),
  }),
};

const exitPermit = {
  body: Joi.object().keys({
    work_order_id: Joi.number().integer().required(),
    qr_token: Joi.string().required(),
    lat: Joi.number().allow(null).optional(),
    lng: Joi.number().allow(null).optional(),
  }),
};

const resolvePermit = {
  params: Joi.object().keys({
    id: Joi.number().integer().required(),
  }),
  body: Joi.object().keys({
    admin_resolution_note: Joi.string().required(),
  }),
};

module.exports = {
  openPermit,
  exitPermit,
  resolvePermit
};
