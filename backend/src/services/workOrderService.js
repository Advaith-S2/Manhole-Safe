const prisma = require('../config/db');

// Verify that referenced Manhole/Contractor/Supervisor rows actually exist so
// we can return a clean 400 instead of letting a raw Prisma FK-constraint
// error bubble up as an opaque 500.
const assertReferencesExist = async ({ manhole_id, contractor_id, supervisor_id }) => {
  const checks = [];
  if (manhole_id !== undefined) {
    checks.push(
      prisma.manhole.findUnique({ where: { id: manhole_id } }).then((m) => {
        if (!m) throw new Error('manhole_id does not reference an existing manhole.');
      })
    );
  }
  if (contractor_id !== undefined) {
    checks.push(
      prisma.contractor.findUnique({ where: { id: contractor_id } }).then((c) => {
        if (!c) throw new Error('contractor_id does not reference an existing contractor.');
      })
    );
  }
  if (supervisor_id !== undefined) {
    checks.push(
      prisma.supervisor.findUnique({ where: { id: supervisor_id } }).then((s) => {
        if (!s) throw new Error('supervisor_id does not reference an existing supervisor.');
      })
    );
  }
  await Promise.all(checks);
};

const createWorkOrder = async (body) => {
  await assertReferencesExist(body);

  // Prevent duplicate active work orders on the same manhole
  const existingActive = await prisma.workOrder.findFirst({
    where: {
      manhole_id: body.manhole_id,
      status: {
        in: ['pending', 'in_progress'],
      },
    },
  });

  if (existingActive) {
    throw new Error('An active work order already exists for this manhole.');
  }

  return prisma.workOrder.create({
    data: body,
  });
};

const getWorkOrders = async (filter = {}) => {
  const { status, limit, page, ...rest } = filter;
  const where = { ...rest };
  if (status) where.status = status;

  // Pagination was accepted by validation but silently ignored before,
  // meaning every request loaded the entire table with full relations.
  const take = limit ? Math.min(limit, 100) : 50;
  const skip = page ? (page - 1) * take : 0;

  return prisma.workOrder.findMany({
    where,
    include: {
      manhole: true,
      contractor: true,
      supervisor: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { created_at: 'desc' },
    take,
    skip,
  });
};

const getWorkOrderById = async (id) => {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      manhole: true,
      contractor: true,
      supervisor: { select: { id: true, name: true, phone: true } },
    },
  });

  if (!workOrder) {
    throw new Error('Work Order not found');
  }
  return workOrder;
};

const updateWorkOrderById = async (id, updateBody) => {
  const current = await getWorkOrderById(id); // Ensure it exists (single lookup, reused below)

  await assertReferencesExist(updateBody);

  if (updateBody.manhole_id || updateBody.status) {
      // Validate conflict if manhole_id or status is changing to an active state
      // This is a simplification; a robust implementation handles partial updates carefully.
      const targetManholeId = updateBody.manhole_id || current.manhole_id;
      const targetStatus = updateBody.status || current.status;

      if (['pending', 'in_progress'].includes(targetStatus)) {
        const existingActive = await prisma.workOrder.findFirst({
          where: {
            manhole_id: targetManholeId,
            status: { in: ['pending', 'in_progress'] },
            id: { not: id },
          },
        });
        if (existingActive) {
          throw new Error('An active work order already exists for this manhole.');
        }
      }
  }

  return prisma.workOrder.update({
    where: { id },
    data: updateBody,
  });
};

const deleteWorkOrderById = async (id) => {
  await getWorkOrderById(id); // Ensure it exists
  return prisma.workOrder.delete({
    where: { id },
  });
};

module.exports = {
  createWorkOrder,
  getWorkOrders,
  getWorkOrderById,
  updateWorkOrderById,
  deleteWorkOrderById,
};
