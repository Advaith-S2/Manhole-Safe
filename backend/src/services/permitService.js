const crypto = require('crypto');
const { calculateDistance } = require('../utils/gps');
const smsService = require('./smsService');
const ppeDetectionService = require('./ppeDetectionService');
const prisma = require('../config/db');
const { getL1TimerMs, getConfirmWindowSeconds } = require('../config/timers');

const LOCATION_THRESHOLD = parseInt(process.env.LOCATION_THRESHOLD_METERS) || 40;

// Resolves a scanned qr_token and runs the three real authorization checks,
// in this exact order, on the permit-open/-exit request itself — never on
// the earlier scan/resolve step. A photographed or reused QR only ever
// proves step (a); it grants nothing on its own without also passing (b)
// and (c) against the logged-in supervisor's own work order.
const authorizeManholeForWorkOrder = async (supervisorId, workOrderId, qrToken) => {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: { manhole: true },
  });

  if (!workOrder) {
    throw new Error('Work Order not found');
  }

  // (a) Does the token resolve to a known manhole?
  const scannedManhole = await prisma.manhole.findUnique({ where: { qr_token: qrToken } });
  if (!scannedManhole) {
    throw new Error('QR Code does not match the assigned manhole for this work order.');
  }

  // (b) Does the logged-in supervisor have an active work order for this manhole?
  if (workOrder.supervisor_id !== supervisorId) {
    throw new Error('You are not authorized to open this work order.');
  }

  // (c) Does the resolved manhole match that work order's assigned manhole?
  if (workOrder.manhole_id !== scannedManhole.id) {
    throw new Error('QR Code does not match the assigned manhole for this work order.');
  }

  return workOrder;
};

const openPermit = async (supervisorId, body, file) => {
  const { work_order_id, qr_token, worker_phone, emergency_contact_phone, lat, lng } = body;

  if (!file) {
    throw new Error('Live photo upload is required.');
  }

  const workOrder = await authorizeManholeForWorkOrder(supervisorId, parseInt(work_order_id), qr_token);

  if (workOrder.status !== 'pending') {
    throw new Error(`Cannot open permit. Work order status is currently: ${workOrder.status}`);
  }

  const hasCoords = lat != null && lng != null && !Number.isNaN(parseFloat(lat)) && !Number.isNaN(parseFloat(lng));
  const entryLat = hasCoords ? parseFloat(lat) : null;
  const entryLng = hasCoords ? parseFloat(lng) : null;
  const locationMissing = !hasCoords;

  let distance = null;
  if (hasCoords) {
    distance = calculateDistance(workOrder.manhole.lat, workOrder.manhole.lng, entryLat, entryLng);
  }

  const locationWarning = distance !== null && distance > LOCATION_THRESHOLD;

  // Run against the entry (PPE) photo before the DB transaction opens — this
  // is an external network call to Roboflow, and wrapping a slow external
  // call inside prisma.$transaction previously caused a silent rollback
  // elsewhere in this file (see the L2-escalation fix in timerJob.js) once
  // the call exceeded Prisma's interactive-transaction timeout. Advisory
  // only: a failed or negative detection is recorded, never blocks opening.
  const ppeResult = await ppeDetectionService.detectPpe(file.path);

  const permitEntry = await prisma.$transaction(async (tx) => {
    await tx.workOrder.update({
      where: { id: workOrder.id },
      data: { status: 'in_progress' },
    });

    const permit = await tx.permitEntry.create({
      data: {
        work_order_id: workOrder.id,
        worker_phone,
        emergency_contact_phone: emergency_contact_phone || null,
        entry_photo_path: `/uploads/${file.filename}`,
        entry_lat: entryLat,
        entry_lng: entryLng,
        location_missing: locationMissing,
        ppe_verified: ppeResult.ppe_verified,
        ppe_detection_result: ppeResult.ppe_detection_result ? JSON.stringify(ppeResult.ppe_detection_result) : null,
        status: 'in_progress',
      },
    });

    return permit;
  });

  await smsService.sendSMS(permitEntry.id, worker_phone, 'entry', { manhole_id: workOrder.manhole.qr_code_id });

  return {
    success: true,
    permit_id: permitEntry.id,
    location_missing: locationMissing,
    location_warning: locationWarning,
    distance_meters: distance !== null ? Math.round(distance) : null,
    ppe_verified: ppeResult.ppe_verified,
  };
};

const exitPermit = async (supervisorId, body, file) => {
  const { work_order_id, qr_token, lat, lng } = body;

  if (!file) {
    throw new Error('Live photo upload is required.');
  }

  const workOrder = await authorizeManholeForWorkOrder(supervisorId, parseInt(work_order_id), qr_token);

  const permitEntry = await prisma.permitEntry.findUnique({
    where: { work_order_id: workOrder.id },
    include: {
      workOrder: {
        include: { manhole: true },
      },
    },
  });

  if (!permitEntry) {
    throw new Error('Permit not found for this work order.');
  }

  if (permitEntry.status !== 'in_progress') {
    throw new Error(`Cannot exit permit. Current status is: ${permitEntry.status}`);
  }

  const hasCoords = lat != null && lng != null && !Number.isNaN(parseFloat(lat)) && !Number.isNaN(parseFloat(lng));
  const exitLat = hasCoords ? parseFloat(lat) : null;
  const exitLng = hasCoords ? parseFloat(lng) : null;
  const locationMissing = !hasCoords;

  let distance = null;
  if (hasCoords) {
    distance = calculateDistance(permitEntry.workOrder.manhole.lat, permitEntry.workOrder.manhole.lng, exitLat, exitLng);
  }

  const locationWarning = distance !== null && distance > LOCATION_THRESHOLD;
  const confirmDeadline = new Date(Date.now() + getConfirmWindowSeconds() * 1000);

  // Cryptographically random, single-use confirmation token — generated at
  // exit-scan time (not entry), stored on the row itself rather than signed
  // as a JWT. This makes the single-use guarantee real: consuming it flips
  // worker_confirm_token_used, and a re-used or guessed token has nothing to
  // decode/verify against, only a DB lookup that will already show "used".
  const confirmToken = crypto.randomBytes(32).toString('hex');

  const updatedPermit = await prisma.permitEntry.update({
    where: { id: permitEntry.id },
    data: {
      exit_photo_path: `/uploads/${file.filename}`,
      exit_time: new Date(),
      exit_lat: exitLat,
      exit_lng: exitLng,
      location_missing: locationMissing,
      worker_confirm_token: confirmToken,
      worker_confirm_token_used: false,
      worker_confirm_expires_at: confirmDeadline,
      status: 'pending_confirmation',
    },
  });

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/['"]/g, '');
  const confirmationLink = `${frontendUrl}/confirm/${confirmToken}`;

  await smsService.sendSMS(updatedPermit.id, updatedPermit.worker_phone, 'exit', {
    manhole_id: permitEntry.workOrder.manhole.qr_code_id,
    link: confirmationLink,
  });

  return {
    success: true,
    permit_id: updatedPermit.id,
    status: updatedPermit.status,
    location_missing: locationMissing,
    location_warning: locationWarning,
    distance_meters: distance !== null ? Math.round(distance) : null,
  };
};

// Allows an admin to manually close out a permit that is stuck in
// 'unconfirmed' or 'escalated' state (e.g. worker never tapped the SMS
// confirmation link). Previously there was a validation schema for this
// (permitValidation.resolvePermit) but no route/controller/service ever
// used it, so escalated permits had no way to be closed.
const resolvePermit = async (permitId, adminResolutionNote, adminId) => {
  const id = parseInt(permitId);

  const permitEntry = await prisma.permitEntry.findUnique({ where: { id } });

  if (!permitEntry) {
    throw new Error('Permit not found.');
  }

  if (!['unconfirmed', 'escalated'].includes(permitEntry.status)) {
    throw new Error(`Cannot resolve permit. Current status is: ${permitEntry.status}`);
  }

  const updatedPermit = await prisma.$transaction(async (tx) => {
    const permit = await tx.permitEntry.update({
      where: { id },
      data: {
        status: 'closed',
        admin_resolution_note: adminResolutionNote,
      },
    });

    await tx.workOrder.update({
      where: { id: permit.work_order_id },
      data: { status: 'completed' },
    });

    return permit;
  });

  return {
    success: true,
    permit_id: updatedPermit.id,
    status: updatedPermit.status,
  };
};

// Read-only lookup of a permit entry (with SMS history) by work order id, for
// the admin ledger detail panel and the supervisor's own ticket. Previously
// there was no way to read a PermitEntry's live status/timers/GPS flags/SMS
// history outside of the open/exit response payloads themselves.
const getPermitByWorkOrder = async (workOrderId) => {
  const permitEntry = await prisma.permitEntry.findUnique({
    where: { work_order_id: parseInt(workOrderId) },
    include: {
      smsLogs: { orderBy: { sent_at: 'asc' } },
      workOrder: { include: { manhole: true } },
    },
  });

  if (!permitEntry) {
    throw new Error('Permit not found for this work order.');
  }

  const manhole = permitEntry.workOrder.manhole;
  const entryDistance =
    permitEntry.entry_lat != null && permitEntry.entry_lng != null
      ? calculateDistance(manhole.lat, manhole.lng, permitEntry.entry_lat, permitEntry.entry_lng)
      : null;
  const exitDistance =
    permitEntry.exit_lat != null && permitEntry.exit_lng != null
      ? calculateDistance(manhole.lat, manhole.lng, permitEntry.exit_lat, permitEntry.exit_lng)
      : null;

  // Absolute deadline the entry-timeout escalation job actually polls
  // against (entry_time + the same L1 timer timerJob.js uses) — exposed so
  // the supervisor UI can count down to a real server-computed instant
  // instead of guessing "demo vs prod" duration client-side, which drifts
  // or resets incorrectly on page refresh.
  const entryDeadline = permitEntry.entry_time
    ? new Date(new Date(permitEntry.entry_time).getTime() + getL1TimerMs())
    : null;

  return {
    id: permitEntry.id,
    work_order_id: permitEntry.work_order_id,
    status: permitEntry.status,
    worker_phone: permitEntry.worker_phone,
    emergency_contact_phone: permitEntry.emergency_contact_phone,
    entry_time: permitEntry.entry_time,
    entry_deadline: entryDeadline,
    // Nested so the supervisor's active-permit screen (and admin ledger
    // detail panel) can render the manhole id/ward without a second request.
    workOrder: {
      id: permitEntry.workOrder.id,
      manhole: {
        qr_code_id: manhole.qr_code_id,
        ward: manhole.ward,
      },
    },
    entry_photo_path: permitEntry.entry_photo_path,
    entry_lat: permitEntry.entry_lat,
    entry_lng: permitEntry.entry_lng,
    exit_time: permitEntry.exit_time,
    exit_photo_path: permitEntry.exit_photo_path,
    exit_lat: permitEntry.exit_lat,
    exit_lng: permitEntry.exit_lng,
    worker_confirmed_time: permitEntry.worker_confirmed_time,
    worker_confirm_expires_at: permitEntry.worker_confirm_expires_at,
    admin_resolution_note: permitEntry.admin_resolution_note,
    location_missing: permitEntry.location_missing,
    location_mismatch:
      (entryDistance !== null && entryDistance > LOCATION_THRESHOLD) ||
      (exitDistance !== null && exitDistance > LOCATION_THRESHOLD),
    entry_distance_meters: entryDistance !== null ? Math.round(entryDistance) : null,
    exit_distance_meters: exitDistance !== null ? Math.round(exitDistance) : null,
    ppe_verified: permitEntry.ppe_verified,
    ppe_detection_result: permitEntry.ppe_detection_result ? JSON.parse(permitEntry.ppe_detection_result) : null,
    sms_logs: permitEntry.smsLogs.map((s) => ({
      id: s.id,
      message_type: s.message_type,
      delivery_status: s.delivery_status,
      sent_at: s.sent_at,
    })),
  };
};

module.exports = {
  openPermit,
  exitPermit,
  resolvePermit,
  getPermitByWorkOrder,
};
