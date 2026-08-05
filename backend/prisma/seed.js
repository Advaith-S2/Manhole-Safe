const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with admin, contractor, ward, manhole, and supervisor data...');

  const passwordHash = await bcrypt.hash('password123', 10);

  await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: passwordHash,
    },
  });

  const contractorSeed = [
    {
      username: 'contractor_alpha',
      name: 'Alpha Construction Ltd',
      sub_contractor_name: 'Beta Services',
    },
    {
      username: 'contractor_omega',
      name: 'Omega Infrastructure',
      sub_contractor_name: 'Northline Contracting',
    },
    {
      username: 'contractor_metro',
      name: 'Metro Safety Works',
      sub_contractor_name: 'Urban Utilities Group',
    },
    {
      username: 'contractor_nova',
      name: 'Nova Public Works',
      sub_contractor_name: 'Civic Link Partners',
    },
  ];

  const contractors = {};
  for (const contractor of contractorSeed) {
    const record = await prisma.contractor.upsert({
      where: { username: contractor.username },
      update: {
        name: contractor.name,
        sub_contractor_name: contractor.sub_contractor_name,
        password: passwordHash,
      },
      create: {
        username: contractor.username,
        password: passwordHash,
        name: contractor.name,
        sub_contractor_name: contractor.sub_contractor_name,
      },
    });
    contractors[contractor.username] = record;
  }

  // John Doe is the supervisor this project's test/demo flows actually log
  // in as and open permits under — his phone is the one Fast2SMS-verified
  // recipient number, so escalation SMS (which goes to the supervisor's own
  // phone) lands somewhere real during testing. The other seeded supervisors
  // keep distinct placeholder numbers: Supervisor.phone is @unique in the
  // schema and doubles as the login identifier, so they can't all share one
  // number without breaking phone-based login.
  const TEST_VERIFIED_PHONE = '+919321814739';
  const supervisors = [
    { name: 'John Doe', phone: TEST_VERIFIED_PHONE, contractorUsername: 'contractor_alpha' },
    { name: 'Jane Smith', phone: '+919876543211', contractorUsername: 'contractor_omega' },
    { name: 'Rahul Mehta', phone: '+919876543212', contractorUsername: 'contractor_metro' },
    { name: 'Aditi Patil', phone: '+919876543213', contractorUsername: 'contractor_alpha' },
    { name: 'Vikram Shah', phone: '+919876543214', contractorUsername: 'contractor_omega' },
    { name: 'Nilesh Rao', phone: '+919876543215', contractorUsername: 'contractor_nova' },
  ];

  for (const sup of supervisors) {
    // Looked up by name first, not upserted by phone: phone is the field
    // most likely to change between seed runs (e.g. pointing a supervisor
    // at a verified test number), and upserting on a value that's about to
    // change creates a duplicate row instead of updating the existing one —
    // the old phone stops matching, so Prisma can't find the row to update.
    const existing = await prisma.supervisor.findFirst({ where: { name: sup.name } });
    if (existing) {
      await prisma.supervisor.update({
        where: { id: existing.id },
        data: {
          phone: sup.phone,
          password: passwordHash,
          contractor_id: contractors[sup.contractorUsername].id,
          is_active: true,
        },
      });
    } else {
      await prisma.supervisor.create({
        data: {
          name: sup.name,
          phone: sup.phone,
          password: passwordHash,
          contractor_id: contractors[sup.contractorUsername].id,
          is_active: true,
        },
      });
    }
  }

  const wardNames = ['Ward A', 'Ward B', 'Ward C', 'Ward D', 'Ward E', 'Ward F'];
  const manholes = [
    { qr_code_id: 'MH-7782', ward: 'Ward A', lat: 19.076, lng: 72.8777 },
    { qr_code_id: 'MH-9921', ward: 'Ward B', lat: 19.08, lng: 72.88 },
    { qr_code_id: 'MH-1102', ward: 'Ward A', lat: 19.0712, lng: 72.8728 },
    { qr_code_id: 'MH-1103', ward: 'Ward A', lat: 19.0738, lng: 72.8759 },
    { qr_code_id: 'MH-1104', ward: 'Ward C', lat: 19.0782, lng: 72.8794 },
    { qr_code_id: 'MH-1105', ward: 'Ward B', lat: 19.0821, lng: 72.8852 },
    { qr_code_id: 'MH-1106', ward: 'Ward D', lat: 19.0842, lng: 72.8885 },
    { qr_code_id: 'MH-1107', ward: 'Ward E', lat: 19.0868, lng: 72.8921 },
    { qr_code_id: 'MH-1108', ward: 'Ward C', lat: 19.0905, lng: 72.8963 },
    { qr_code_id: 'MH-1109', ward: 'Ward F', lat: 19.0937, lng: 72.8998 },
    { qr_code_id: 'MH-1110', ward: 'Ward D', lat: 19.0959, lng: 72.9016 },
    { qr_code_id: 'MH-1111', ward: 'Ward E', lat: 19.0983, lng: 72.9048 },
    { qr_code_id: 'MH-1112', ward: 'Ward F', lat: 19.1011, lng: 72.9072 },
    { qr_code_id: 'MH-2211', ward: 'Ward A', lat: 19.0688, lng: 72.8705 },
    { qr_code_id: 'MH-3019', ward: 'Ward B', lat: 19.0854, lng: 72.8829 },
    { qr_code_id: 'MH-4055', ward: 'Ward C', lat: 19.0917, lng: 72.8966 },
    { qr_code_id: 'MH-5090', ward: 'Ward D', lat: 19.1002, lng: 72.9034 },
  ];

  const manholeRecords = {};
  for (const mh of manholes) {
    // qr_token is the unguessable value actually encoded in the printed QR
    // (qr_code_id stays the human-readable label). Only set on create, never
    // on update, so re-running the seed can't invalidate tokens already
    // printed onto physical tags.
    const record = await prisma.manhole.upsert({
      where: { qr_code_id: mh.qr_code_id },
      update: { ward: mh.ward, lat: mh.lat, lng: mh.lng },
      create: {
        qr_code_id: mh.qr_code_id,
        qr_token: crypto.randomBytes(24).toString('hex'),
        ward: mh.ward,
        lat: mh.lat,
        lng: mh.lng,
      },
    });
    manholeRecords[mh.qr_code_id] = record;
  }

  const contractorIds = Object.values(contractors).map((contractor) => contractor.id);
  const allSupervisorRows = await prisma.supervisor.findMany({
    orderBy: { id: 'asc' },
  });

  const workOrders = [
    {
      manholeQr: 'MH-1102',
      contractorUsername: 'contractor_alpha',
      supervisorPhone: TEST_VERIFIED_PHONE,
      status: 'pending',
      payment_status: 'pending',
    },
    {
      manholeQr: 'MH-1105',
      contractorUsername: 'contractor_omega',
      supervisorPhone: '+919876543211',
      status: 'in_progress',
      payment_status: 'pending',
    },
    {
      manholeQr: 'MH-1108',
      contractorUsername: 'contractor_metro',
      supervisorPhone: '+919876543212',
      status: 'completed',
      payment_status: 'paid',
    },
    {
      manholeQr: 'MH-1111',
      contractorUsername: 'contractor_nova',
      supervisorPhone: '+919876543215',
      status: 'pending',
      payment_status: 'pending',
    },
  ];

  for (const job of workOrders) {
    const supervisor = allSupervisorRows.find((row) => row.phone === job.supervisorPhone);
    const contractor = contractors[job.contractorUsername];
    if (!supervisor || !contractor || !manholeRecords[job.manholeQr]) continue;

    await prisma.workOrder.upsert({
      where: {
        id: ((await prisma.workOrder.findFirst({
          where: { manhole_id: manholeRecords[job.manholeQr].id, contractor_id: contractor.id, supervisor_id: supervisor.id },
          select: { id: true },
        })) || { id: -1 }).id,
      },
      update: {
        status: job.status,
        payment_status: job.payment_status,
        scheduled_time: new Date(Date.now() - 3600000),
        estimated_end_time: new Date(Date.now() + 3600000),
      },
      create: {
        manhole_id: manholeRecords[job.manholeQr].id,
        contractor_id: contractor.id,
        supervisor_id: supervisor.id,
        scheduled_time: new Date(Date.now() - 3600000),
        estimated_end_time: new Date(Date.now() + 3600000),
        status: job.status,
        payment_status: job.payment_status,
      },
    });
  }

  console.log('Seeding finished.');
  console.log('Ward data:', wardNames.join(', '));
  console.log('Contractors seeded:', Object.keys(contractors).join(', '));
  console.log('Supervisors seeded:', supervisors.map((s) => s.phone).join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
