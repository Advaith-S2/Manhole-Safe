const express = require('express');
const prisma = require('../config/db');
const auth = require('../middlewares/auth');
const Joi = require('joi');
const validate = require('../middlewares/validate');

const router = express.Router();

const supervisorSchema = {
  body: Joi.object().keys({
    name: Joi.string().trim().min(2).required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{9,14}$/).required(),
  }),
};

router.use(auth(['contractor']));

router.get('/me', async (req, res, next) => {
  try {
    const contractor = await prisma.contractor.findUnique({
      where: { id: req.user.id },
      select: { id: true, username: true, name: true, sub_contractor_name: true },
    });
    res.json(contractor);
  } catch (error) {
    next(error);
  }
});

router.get('/supervisors', async (req, res, next) => {
  try {
    const rows = await prisma.supervisor.findMany({
      where: { contractor_id: req.user.id, is_active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, phone: true, is_active: true, contractor_id: true },
    });
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// Read-only, intentionally narrow: manhole id, assigned supervisor, status,
// and scheduled time only. No payment_status, no contractor_id/created_at,
// and no permit-level detail (photos, GPS, SMS logs) — those stay Admin-only.
// Explicit `select` here rather than `include` on top of a bare query, since
// `include` returns every scalar column of WorkOrder itself and would leak
// payment_status straight into the response.
router.get('/work-orders', async (req, res, next) => {
  try {
    const rows = await prisma.workOrder.findMany({
      where: { contractor_id: req.user.id },
      select: {
        id: true,
        status: true,
        scheduled_time: true,
        manhole: { select: { id: true, qr_code_id: true, ward: true } },
        supervisor: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { scheduled_time: 'desc' },
    });
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post('/supervisors', validate(supervisorSchema), async (req, res, next) => {
  try {
    const exists = await prisma.supervisor.findUnique({ where: { phone: req.body.phone } });
    if (exists) {
      return res.status(409).json({ message: 'A supervisor with this phone number already exists.' });
    }

    const supervisor = await prisma.supervisor.create({
      data: {
        name: req.body.name,
        phone: req.body.phone,
        password: '$2a$10$Qx3u7wrM2WfRrJ1g8YednO9jRUrG4F7A5g7d5xU1R3kJ0Q1w0mQeK',
        contractor_id: req.user.id,
      },
      select: { id: true, name: true, phone: true, is_active: true, contractor_id: true },
    });
    res.status(201).json(supervisor);
  } catch (error) {
    next(error);
  }
});

router.patch('/supervisors/:id', validate(supervisorSchema), async (req, res, next) => {
  try {
    const supervisor = await prisma.supervisor.findFirst({
      where: { id: Number(req.params.id), contractor_id: req.user.id },
    });

    if (!supervisor) {
      return res.status(404).json({ message: 'Supervisor not found.' });
    }

    const updated = await prisma.supervisor.update({
      where: { id: supervisor.id },
      data: {
        name: req.body.name,
        phone: req.body.phone,
      },
      select: { id: true, name: true, phone: true, is_active: true, contractor_id: true },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.patch('/supervisors/:id/deactivate', async (req, res, next) => {
  try {
    const supervisor = await prisma.supervisor.findFirst({
      where: { id: Number(req.params.id), contractor_id: req.user.id },
    });

    if (!supervisor) {
      return res.status(404).json({ message: 'Supervisor not found.' });
    }

    const updated = await prisma.supervisor.update({
      where: { id: supervisor.id },
      data: { is_active: false },
      select: { id: true, name: true, phone: true, is_active: true, contractor_id: true },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
