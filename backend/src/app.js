const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./middlewares/errorHandler');
const routes = require('./routes');
const auth = require('./middlewares/auth');
const path = require('path');

const app = express();

// Basic security headers (no external dependency required).
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// parse json request body
app.use(express.json());

// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));

// Restrict CORS to configured origin(s) instead of allowing any origin by
// default; falls back to '*' only if nothing is configured (dev convenience).
const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.replace(/['"]/g, '').split(',') : '*';
app.use(cors({ origin: corsOrigin }));

// Serve uploaded entry/exit photos of workers only to authenticated
// admin/supervisor users. Previously these were world-readable static files
// with no access control at all, exposing worker photos and GPS-linked
// evidence to anyone who guessed/enumerated a filename.
app.use('/uploads', auth(['admin', 'supervisor']), express.static(path.join(__dirname, '../uploads')));

// v1 api routes
app.use('/api', routes);

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  res.status(404).json({ message: 'Not found' });
});

// handle errors
app.use(errorHandler);

module.exports = app;
