const SmsProviderInterface = require('./SmsProviderInterface');
const logger = require('../../../config/logger');

class MockProvider extends SmsProviderInterface {
  async send(to, message) {
    logger.info(`[MOCK SMS] To: ${to} | Body: ${message}`);
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 200));
    return {
      success: true,
      status: 'delivered', // Mock always delivers instantly
    };
  }
}

module.exports = MockProvider;
