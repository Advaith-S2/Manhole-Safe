class SmsProviderInterface {
  /**
   * Send an SMS
   * @param {string} to - The recipient's phone number
   * @param {string} message - The message body
   * @returns {Promise<{success: boolean, status: string, error?: string}>}
   */
  async send(to, message) {
    throw new Error('Method not implemented.');
  }
}

module.exports = SmsProviderInterface;
