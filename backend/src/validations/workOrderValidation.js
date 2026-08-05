const Joi = require('joi');

const createWorkOrder = {
  body: Joi.object().keys({
    manhole_id: Joi.number().integer().required(),
    contractor_id: Joi.number().integer().required(),
    supervisor_id: Joi.number().integer().required(),
    scheduled_time: Joi.date().iso().required(),
    estimated_end_time: Joi.date().iso().allow(null),
  }),
};

const getWorkOrders = {
  query: Joi.object().keys({
    status: Joi.string().valid('pending', 'in_progress', 'completed'),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getWorkOrder = {
  params: Joi.object().keys({
    id: Joi.number().integer().required(),
  }),
};

const updateWorkOrder = {
  params: Joi.object().keys({
    id: Joi.number().integer().required(),
  }),
  body: Joi.object()
    .keys({
      manhole_id: Joi.number().integer(),
      contractor_id: Joi.number().integer(),
      supervisor_id: Joi.number().integer(),
      scheduled_time: Joi.date().iso(),
      estimated_end_time: Joi.date().iso().allow(null),
      status: Joi.string().valid('pending', 'in_progress', 'completed'),
      payment_status: Joi.string().valid('pending', 'paid'),
    })
    .min(1),
};

const deleteWorkOrder = {
  params: Joi.object().keys({
    id: Joi.number().integer().required(),
  }),
};

module.exports = {
  createWorkOrder,
  getWorkOrders,
  getWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
};
