const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function main() {
  const prisma = new PrismaClient();
  try {
    const admin = await prisma.admin.findUnique({ where: { username: 'admin' } });
    console.log('ADMIN_FOUND', !!admin);
    if (admin) {
      console.log('ADMIN_HASH', admin.password);
      console.log('ADMIN_COMPARE', await bcrypt.compare('password123', admin.password));
    }

    const contractor = await prisma.contractor.findFirst({ where: { username: 'contractor_alpha' } });
    console.log('CONTRACTOR_FOUND', !!contractor);
    if (contractor) {
      console.log('CONTRACTOR_HASH', contractor.password);
      console.log('CONTRACTOR_COMPARE', await bcrypt.compare('password123', contractor.password));
    }

    const supervisor = await prisma.supervisor.findUnique({ where: { phone: '+919876543210' } });
    console.log('SUPERVISOR_FOUND', !!supervisor);
    if (supervisor) {
      console.log('SUPERVISOR_HASH', supervisor.password);
      console.log('SUPERVISOR_COMPARE', await bcrypt.compare('password123', supervisor.password));
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
