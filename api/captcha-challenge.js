// GET /api/captcha-challenge: a fresh proof-of-work challenge for the forms
// (see api/captcha.js). {configured:false} when CAPTCHA_SECRET is empty, so the
// browser skips the step. Never cached: every visitor needs their own.
import { buildChallenge } from './captcha.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  try {
    const challenge = await buildChallenge();
    if (!challenge) return res.json({ configured: false });
    const { algorithm, challenge: hash, salt, signature, maxnumber } = challenge;
    return res.json({ configured: true, algorithm, challenge: hash, salt, signature, maxnumber });
  } catch (error) {
    console.error('Captcha challenge error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not create a challenge. Please try again.' });
  }
}
