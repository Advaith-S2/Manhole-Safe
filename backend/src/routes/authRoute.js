const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const validate = require('../middlewares/validate');
const Joi = require('joi');

const router = express.Router();

// Login endpoints previously had no rate limiting at all, unlike the public
// confirm endpoint, leaving them open to unlimited password brute-forcing.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts from this IP, please try again after 15 minutes' },
});

router.post(
  '/admin/login',
  loginLimiter,
  validate({
    body: Joi.object().keys({
      username: Joi.string().required(),
      password: Joi.string().required(),
    }),
  }),
  authController.loginAdmin
);

router.post(
  '/supervisor/login',
  loginLimiter,
  validate({
    body: Joi.object().keys({
      phone: Joi.string().required(),
      password: Joi.string().required(),
    }),
  }),
  authController.loginSupervisor
);

router.post(
  '/contractor/login',
  loginLimiter,
  validate({
    body: Joi.object().keys({
      username: Joi.string().required(),
      password: Joi.string().required(),
    }),
  }),
  authController.loginContractor
);

module.exports = router;
