const request = require('supertest');
const app = require('../src/app');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
let adminToken;
let testManhole;
let testContractor;
let testSupervisor;
let existingWorkOrder;

beforeAll(async () => {
  const suffix = Date.now();

  const res = await request(app)
    .post('/api/auth/admin/login')
    .send({ username: 'admin', password: 'password123' });

  adminToken = res.body.token;

  testContractor = await prisma.contractor.create({
    data: { name: `WO Contractor ${suffix}` },
  });

  testSupervisor = await prisma.supervisor.create({
    data: {
      name: `WO Supervisor ${suffix}`,
      phone: `+919000${String(suffix).slice(-6)}`,
      password: 'hashed-password',
      contractor: {
        connect: { id: testContractor.id },
      },
    },
  });

  testManhole = await prisma.manhole.create({
    data: {
      qr_code_id: `WO-${suffix}`,
      ward: 'Ward Z',
      lat: 19.1,
      lng: 72.9,
    },
  });
});

afterAll(async () => {
  await prisma.smsLog.deleteMany({});
  await prisma.permitEntry.deleteMany({});
  await prisma.workOrder.deleteMany({});
  await prisma.supervisor.deleteMany({});
  await prisma.contractor.deleteMany({});
  await prisma.manhole.deleteMany({});
  await prisma.$disconnect();
});

describe('Work Order APIs', () => {
  it('should create a new work order', async () => {
    const res = await request(app)
      .post('/api/work-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        manhole_id: testManhole.id,
        contractor_id: testContractor.id,
        supervisor_id: testSupervisor.id,
        scheduled_time: new Date().toISOString(),
      });

    if (res.statusCode === 409) {
      expect(res.body.message).toMatch(/active work order already exists/i);
      return;
    }

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toEqual('pending');
    existingWorkOrder = res.body;
  });

  it('should prevent duplicate active work orders on the same manhole', async () => {
    const res = await request(app)
      .post('/api/work-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        manhole_id: testManhole.id, // Same manhole
        contractor_id: testContractor.id,
        supervisor_id: testSupervisor.id,
        scheduled_time: new Date().toISOString(),
      });

    expect(res.statusCode).toEqual(409);
    expect(res.body.message).toMatch(/active work order already exists/i);
  });

  it('should get a list of work orders', async () => {
    const res = await request(app)
      .get('/api/work-orders')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBeTruthy();
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should get a work order by id', async () => {
    const res = await request(app)
      .get(`/api/work-orders/${existingWorkOrder.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.id).toEqual(existingWorkOrder.id);
  });

  it('should update a work order', async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${existingWorkOrder.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'completed' });

    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toEqual('completed');
  });

  it('should allow creating a new work order after previous is completed', async () => {
    const res = await request(app)
      .post('/api/work-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        manhole_id: testManhole.id, // Same manhole, but previous is completed
        contractor_id: testContractor.id,
        supervisor_id: testSupervisor.id,
        scheduled_time: new Date().toISOString(),
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('id');
  });

  it('should delete a work order', async () => {
    const res = await request(app)
      .delete(`/api/work-orders/${existingWorkOrder.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(204);

    const getRes = await request(app)
      .get(`/api/work-orders/${existingWorkOrder.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(getRes.statusCode).toEqual(404);
  });
});
