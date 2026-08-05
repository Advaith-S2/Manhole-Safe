const express = require('express');
const prisma = require('../config/db');

const authRoute = require('./authRoute');
const workOrderRoute = require('./workOrderRoute');
const permitRoute = require('./permitRoute');
const publicRoute = require('./publicRoute');
const contractorRoute = require('./contractorRoute');
const scanRoute = require('./scanRoute');
const qrRoute = require('./qrRoute');
const auth = require('../middlewares/auth');

const router = express.Router();

router.use('/auth', authRoute);
router.use('/work-orders', workOrderRoute);
router.use('/supervisor/permit', permitRoute);
router.use('/contractor', contractorRoute);
router.use('/public', publicRoute);
router.use('/scan', scanRoute);
router.use('/admin/qr', qrRoute);

router.get('/reference/contractors', auth(['admin', 'supervisor']), async (req, res, next) => {
  try {
    const contractors = await prisma.contractor.findMany({ orderBy: { name: 'asc' } });
    res.json(contractors);
  } catch (error) {
    next(error);
  }
});

router.get('/reference/manholes', auth(['admin', 'supervisor']), async (req, res, next) => {
  try {
    const { ward } = req.query;
    const rows = await prisma.manhole.findMany({
      where: ward ? { ward: String(ward) } : {},
      orderBy: { qr_code_id: 'asc' },
    });
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// Manhole lat/lng only ever come from the seed script — nothing in the app
// updates them, so any manhole tested against a real physical location
// (rather than the seed's fictional Mumbai coordinates) always reads as a
// huge GPS mismatch. This lets an admin set the real coordinates once,
// without touching seed.js or the database directly.
router.patch('/admin/manholes/:id/location', auth(['admin']), async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return res.status(400).json({ message: 'lat and lng must be valid numbers.' });
    }
    const manhole = await prisma.manhole.update({
      where: { id: parseInt(req.params.id, 10) },
      data: { lat: latNum, lng: lngNum },
    });
    res.json(manhole);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Manhole not found.' });
    }
    next(error);
  }
});

router.get('/reference/supervisors', auth(['admin', 'supervisor']), async (req, res, next) => {
  try {
    const { contractor_id } = req.query;
    const where = contractor_id ? { contractor_id: Number(contractor_id), is_active: true } : { is_active: true };
    const rows = await prisma.supervisor.findMany({
      where,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, phone: true, contractor_id: true },
    });
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// Sample Protected Routes
router.get('/admin/dashboard', auth(['admin']), (req, res) => {
  res.json({ message: 'Welcome Admin!', user: req.user });
});

router.get('/supervisor/dashboard', auth(['supervisor', 'admin']), (req, res) => {
  res.json({ message: 'Welcome Supervisor!', user: req.user });
});

module.exports = router;
