const SmsProviderInterface = require('./SmsProviderInterface');
const logger = require('../../../config/logger');

const FAST2SMS_URL = 'https://www.fast2sms.com/dev/bulkV2';

class Fast2SmsProvider extends SmsProviderInterface {
  constructor() {
    super();
    this.apiKey = process.env.FAST2SMS_API_KEY;
    this.route = process.env.FAST2SMS_ROUTE || 'q';
  }

  async send(to, message) {
    try {
      logger.info(`[FAST2SMS] Sending to: ${to}...`);

      if (!this.apiKey) {
        throw new Error('FAST2SMS_API_KEY is not set.');
      }

      // Fast2SMS expects the bare 10-digit Indian number for the "q" route,
      // not the E.164 "+91..." format the rest of the app stores/validates
      // against — strip a leading +91/91 if present.
      const numbers = to.replace(/^\+?91/, '');

      const res = await fetch(FAST2SMS_URL, {
        method: 'POST',
        headers: {
          Authorization: this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: this.route,
          message,
          language: 'english',
          flash: 0,
          numbers,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.return !== true) {
        const errorMessage = data?.message?.join?.(', ') || data?.message || `HTTP ${res.status}`;
        throw new Error(errorMessage);
      }

      return {
        success: true,
        status: 'sent',
      };
    } catch (error) {
      logger.error(`[FAST2SMS ERROR] ${error.message}`);
      return {
        success: false,
        status: 'failed',
        error: error.message,
      };
    }
  }
}

module.exports = Fast2SmsProvider;
