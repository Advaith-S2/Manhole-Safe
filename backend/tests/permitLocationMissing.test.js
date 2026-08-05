const prisma = require('../src/config/db');
const permitService = require('../src/services/permitService');

describe('permit open flow with missing GPS', () => {
  let contractor;
  let supervisor;
  let manhole;
  let workOrder;

  beforeAll(async () => {
    const suffix = Date.now();

    contractor = await prisma.contractor.create({
      data: { name: `GPS Test Contractor ${suffix}` },
    });

    supervisor = await prisma.supervisor.create({
      data: {
        name: 'GPS Test Supervisor',
        phone: `+919000000${String(suffix % 100000).padStart(5, '0')}`,
        password: 'hashed-password',
        contractor: {
          connect: { id: contractor.id },
        },
      },
    });

    manhole = await prisma.manhole.create({
      data: {
        qr_code_id: `MH-GPS-TEST-${suffix}`,
        ward: 'Ward C',
        lat: 19.076,
        lng: 72.8777,
      },
    });

    workOrder = await prisma.workOrder.create({
      data: {
        manhole_id: manhole.id,
        contractor_id: contractor.id,
        supervisor_id: supervisor.id,
        scheduled_time: new Date(),
        status: 'pending',
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

  test('allows permit open when lat/lng are null and stores location_missing=true', async () => {
    const file = { filename: 'missing-gps.jpg' };

    const result = await permitService.openPermit(supervisor.id, {
      work_order_id: workOrder.id,
      qr_manhole_id: manhole.qr_code_id,
      worker_phone: '+919999999999',
      lat: null,
      lng: null,
      emergency_contact_phone: '+919111111111',
    }, file);

    expect(result.success).toBe(true);
    expect(result.location_missing).toBe(true);

    const permit = await prisma.permitEntry.findFirst({
      where: { work_order_id: workOrder.id },
    });

    expect(permit.location_missing).toBe(true);
    expect(permit.emergency_contact_phone).toBe('+919111111111');
  });
});
