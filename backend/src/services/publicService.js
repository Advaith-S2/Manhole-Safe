const prisma = require('../config/db');

// Looks up a PermitEntry by its stored worker_confirm_token. Deliberately
// does not distinguish "token doesn't exist" from "token exists but is
// wrong shape" in its error — same principle as the QR scan lookup: don't
// give an attacker a way to tell malformed from merely-unknown.
const findPermitByToken = async (token) => {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid or expired confirmation link.');
  }

  const permitEntry = await prisma.permitEntry.findUnique({
    where: { worker_confirm_token: token },
    include: { workOrder: { include: { manhole: true, contractor: true } } },
  });

  if (!permitEntry) {
    throw new Error('Invalid or expired confirmation link.');
  }

  return permitEntry;
};

const confirmPermit = async (token) => {
  const permitEntry = await findPermitByToken(token);

  // Single-use: a token already marked used cannot be replayed, even if the
  // permit's status was somehow left in a confirmable-looking state.
  if (permitEntry.worker_confirm_token_used) {
    throw new Error('This permit has already been confirmed and closed.');
  }

  if (permitEntry.worker_confirm_expires_at && new Date(permitEntry.worker_confirm_expires_at).getTime() <= Date.now()) {
    throw new Error('Invalid or expired confirmation link.');
  }

  if (!['pending_confirmation', 'unconfirmed', 'escalated'].includes(permitEntry.status)) {
    throw new Error(`Permit is in an invalid state for confirmation: ${permitEntry.status}`);
  }

  const now = new Date();

  const updatedPermit = await prisma.$transaction(async (tx) => {
    const permit = await tx.permitEntry.update({
      where: { id: permitEntry.id },
      data: {
        status: 'closed',
        worker_confirmed_time: now,
        worker_confirm_token_used: true,
      },
    });

    await tx.workOrder.update({
      where: { id: permitEntry.work_order_id },
      data: {
        status: 'completed',
        payment_status: 'paid',
      },
    });

    return permit;
  });

  return {
    success: true,
    message: 'Safety confirmed successfully. Payment unlocked.',
    data: {
      permit_id: permitEntry.id,
      manhole_id: permitEntry.workOrder.manhole.qr_code_id,
      ward: permitEntry.workOrder.manhole.ward,
      worker_phone: permitEntry.worker_phone,
      confirmed_at: now,
    },
  };
};

// Read-only preview of what a confirmation token points to, so the worker
// page can show the fact block (manhole, entry time, contractor) before the
// worker taps confirm, without mutating anything. Mirrors the same
// token/state checks as confirmPermit but performs no writes.
const getPermitPreview = async (token) => {
  const permitEntry = await findPermitByToken(token);

  if (permitEntry.worker_confirm_token_used || permitEntry.status === 'closed') {
    const err = new Error('This confirmation was already recorded.');
    err.alreadyConfirmed = true;
    err.confirmedAt = permitEntry.worker_confirmed_time;
    throw err;
  }

  if (permitEntry.worker_confirm_expires_at && new Date(permitEntry.worker_confirm_expires_at).getTime() <= Date.now()) {
    throw new Error('Invalid or expired confirmation link.');
  }

  return {
    manhole_id: permitEntry.workOrder.manhole.qr_code_id,
    ward: permitEntry.workOrder.manhole.ward,
    contractor_name: permitEntry.workOrder.contractor.name,
    entry_time: permitEntry.entry_time,
  };
};

module.exports = {
  confirmPermit,
  getPermitPreview,
};
