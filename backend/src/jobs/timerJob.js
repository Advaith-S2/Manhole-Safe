const cron = require('node-cron');
const smsService = require('../services/smsService');
const logger = require('../config/logger');
const prisma = require('../config/db');
const { getL1TimerMs, getL2TimerMs } = require('../config/timers');

const startBackgroundJobs = () => {
  logger.info('Starting Background Scheduling Jobs...');

  // Poll every 10s; this is meaningfully smaller than the shortest timeout window
  // used in demo/prod operation, so the job can detect expired entry windows and
  // worker confirmation deadlines without drifting far behind real time.
  cron.schedule('*/10 * * * * *', async () => {
    try {
      const l1Timer = getL1TimerMs();
      const l2Timer = getL2TimerMs();

      const now = new Date();

      const permitsToCheck = await prisma.permitEntry.findMany({
        where: {
          OR: [
            { status: 'in_progress' },
            { status: 'pending_confirmation' },
            { status: 'unconfirmed' },
          ],
        },
        include: {
          workOrder: {
            include: { supervisor: true, manhole: true }
          },
          smsLogs: {
            where: {
              message_type: { in: ['escalation_supervisor', 'escalation_nodal'] }
            }
          }
        },
      });

      for (const permit of permitsToCheck) {
        if (permit.status === 'pending_confirmation') {
          if (permit.worker_confirm_expires_at && new Date(permit.worker_confirm_expires_at).getTime() <= now.getTime()) {
            logger.info(`Permit ${permit.id} confirmation window expired; marking as unconfirmed.`);
            await prisma.permitEntry.update({
              where: { id: permit.id },
              data: { status: 'unconfirmed' },
            });
          }
          continue;
        }

        // Deliberately does not escalate further: the supervisor already
        // confirmed (via the exit scan) that the worker was physically out.
        // What's missing is only the independent worker-side confirmation,
        // which is a lower-severity gap than a permit stuck in_progress with
        // no supervisor sign-off at all. Stays admin-resolvable only.
        if (permit.status === 'unconfirmed') continue;

        if (permit.status !== 'in_progress' || !permit.entry_time) continue;

        const supervisorLog = permit.smsLogs.find(log => log.message_type === 'escalation_supervisor');
        const nodalLog = permit.smsLogs.find(log => log.message_type === 'escalation_nodal');

        if (supervisorLog && !nodalLog) {
          const l1Time = new Date(supervisorLog.sent_at).getTime();
          if (now.getTime() - l1Time > l2Timer) {
            logger.info(`Escalating Permit ${permit.id} to Level 2 (Nodal Officer)`);
            // Send first, update status after — not wrapped in a DB
            // transaction. Prisma's interactive-transaction timeout
            // (default 5s) was previously wrapping this SMS call, and a
            // live provider response occasionally exceeding 5s silently
            // rolled back the status update while smsService's own
            // (separately-connected) smsLog write still committed — the
            // permit stayed 'in_progress' forever despite the nodal SMS
            // having actually sent. The job is idempotent via smsLogs
            // either way, so there's nothing atomicity was protecting here.
            const nodalPhone = process.env.NODAL_PHONE || permit.workOrder.supervisor.phone;
            await smsService.sendSMS(permit.id, nodalPhone, 'escalation_nodal', {
              emergency_contact_phone: permit.emergency_contact_phone,
              worker_phone: permit.worker_phone,
              manhole_id: permit.workOrder.manhole.qr_code_id,
            });
            await prisma.permitEntry.update({
              where: { id: permit.id },
              data: { status: 'escalated' },
            });
            continue;
          }
        }

        if (!supervisorLog) {
          const entryTime = new Date(permit.entry_time).getTime();
          if (now.getTime() - entryTime > l1Timer) {
            logger.info(`Escalating Permit ${permit.id} to Level 1 (Supervisor)`);
            await smsService.sendSMS(permit.id, permit.workOrder.supervisor.phone, 'escalation_supervisor', {
              emergency_contact_phone: permit.emergency_contact_phone,
              worker_phone: permit.worker_phone,
              manhole_id: permit.workOrder.manhole.qr_code_id,
            });
          }
        }
      }
    } catch (error) {
      logger.error(`Error in Background Timer Job: ${error.message}`);
    }
  });
};

module.exports = {
  startBackgroundJobs,
};
