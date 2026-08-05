require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

// Single shared Prisma instance. Previously every service file created its own
// `new PrismaClient()`, which opens a separate connection pool per file and can
// exhaust DB connections under load. Reuse one client everywhere.
const prisma = new PrismaClient();

module.exports = prisma;
