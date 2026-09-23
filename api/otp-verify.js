import 'dotenv/config';
import { isOtpConfigured, checkOtp } from './otp-helpers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  if (!isOtpConfigured()) {
    return res.json({ success: true, configured: false, valid: false });
  }

  const { token, code } = req.body || {};
  if (!token || !code) {
    return res.status(400).json({ success: false, message: 'Missing verification token or code.' });
  }

  const result = checkOtp(token, code);
  if (!result.valid) {
    return res.json({ success: true, configured: true, valid: false, message: result.reason });
  }

  return res.json({ success: true, configured: true, valid: true });
}
