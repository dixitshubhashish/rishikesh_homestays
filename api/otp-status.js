import 'dotenv/config';
import { isOtpConfigured } from './otp-helpers.js';

export default async function handler(req, res) {
  return res.json({ configured: isOtpConfigured() });
}
