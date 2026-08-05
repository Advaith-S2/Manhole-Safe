const MockProvider = require('./providers/MockProvider');
const Fast2SmsProvider = require('./providers/Fast2SmsProvider');

class SmsFactory {
  static getProvider() {
    const providerName = process.env.SMS_PROVIDER || (process.env.MOCK_SMS === 'true' ? 'mock' : 'fast2sms');

    switch (providerName.toLowerCase()) {
      case 'mock':
        return new MockProvider();
      case 'fast2sms':
        return new Fast2SmsProvider();
      default:
        throw new Error(`Unsupported SMS provider: ${providerName}`);
    }
  }
}

module.exports = SmsFactory;
