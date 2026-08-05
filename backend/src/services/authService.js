const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const generateToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const loginAdmin = async (username, password) => {
  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin || !(await bcrypt.compare(password, admin.password))) {
    throw new Error('Incorrect username or password');
  }
  return { admin: { id: admin.id, username: admin.username }, token: generateToken(admin.id, 'admin') };
};

const loginSupervisor = async (phone, password) => {
  const supervisor = await prisma.supervisor.findUnique({ where: { phone } });
  if (!supervisor || !(await bcrypt.compare(password, supervisor.password))) {
    throw new Error('Incorrect phone number or password');
  }
  return { supervisor: { id: supervisor.id, name: supervisor.name, phone: supervisor.phone }, token: generateToken(supervisor.id, 'supervisor') };
};

const loginContractor = async (username, password) => {
  const contractor = await prisma.contractor.findUnique({ where: { username } });
  if (!contractor || !(await bcrypt.compare(password, contractor.password))) {
    throw new Error('Incorrect username or password');
  }
  return {
    contractor: { id: contractor.id, username: contractor.username, name: contractor.name },
    token: generateToken(contractor.id, 'contractor'),
  };
};

module.exports = {
  loginAdmin,
  loginSupervisor,
  loginContractor,
};
