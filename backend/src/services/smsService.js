const logger = require('../config/logger');
const SmsFactory = require('./sms/SmsFactory');
const prisma = require('../config/db');

const sendSMS = async (permit_entry_id, phone, message_type, context) => {
  try {
    let messageBody = '';

    switch (message_type) {
      case 'entry':
        messageBody = `Duty of Care: You have entered Manhole ${context.manhole_id}. Stay safe.`;
        break;
      case 'exit':
        messageBody = `Please confirm your exit from Manhole ${context.manhole_id} using this link: ${context.link}`;
        break;
      case 'reminder':
        messageBody = `REMINDER: You have been in Manhole ${context.manhole_id} for a while. Please exit safely soon.`;
        break;
      case 'escalation_supervisor':
        messageBody = `ALERT: Manhole ${context.manhole_id} (Permit ${permit_entry_id}) has exceeded the time limit. Please check on the worker (${context.worker_phone}).`;
        break;
      case 'escalation_nodal':
        messageBody = `CRITICAL ESCALATION: Manhole ${context.manhole_id} (Permit ${permit_entry_id}) is severely overdue. Worker: ${context.worker_phone}${context.emergency_contact_phone ? `, Emergency contact: ${context.emergency_contact_phone}` : ''}. Immediate action required.`;
        break;
      default:
        messageBody = 'System notification';
    }

    const provider = SmsFactory.getProvider();
    
    // Call the abstracted provider
    const response = await provider.send(phone, messageBody);

    // Log the SMS in the database with the provider's returned status
    await prisma.smsLog.create({
      data: {
        permit_entry_id,
        message_type,
        delivery_status: response.status,
      },
    });

    return response.success;
  } catch (error) {
    logger.error(`SMS Service Error: ${error.message}`);
    
    // Log the failed SMS
    try {
      await prisma.smsLog.create({
        data: {
          permit_entry_id,
          message_type,
          delivery_status: 'failed',
        },
      });
    } catch (dbError) {
       logger.error(`Failed to record SMS failure in DB: ${dbError.message}`);
    }

    return false;
  }
};

module.exports = {
  sendSMS,
};
