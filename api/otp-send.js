import 'dotenv/config';
import { Resend } from 'resend';
import { isOtpConfigured, generateOtp } from './otp-helpers.js';
import { verifyCaptcha, CAPTCHA_FAILED_CODE, CAPTCHA_FAILED_MESSAGE } from './captcha.js';

// Built on the first request, not at import: the SDK throws without a key, and server.js imports this file.
let resend;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // This endpoint emails an arbitrary address, so it is an abuse vector: it needs
  // the same bot check as the enquiry (a no-op while CAPTCHA_SECRET is empty).
  if (!(await verifyCaptcha(req.body?.captcha))) {
    return res.status(400).json({ success: false, code: CAPTCHA_FAILED_CODE, message: CAPTCHA_FAILED_MESSAGE });
  }

  if (!isOtpConfigured()) {
    return res.json({ success: true, configured: false });
  }

  resend ||= new Resend(process.env.RESEND_API_KEY);

  const email = String(req.body?.email || '').trim();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
  }

  const { code, token } = generateOtp(email);

  try {
    const result = await resend.emails.send({
      from: 'hello@rishikeshhomestays.com',
      to: email,
      subject: `${code} is your Rishikesh Homestays verification code`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #333;">Verify your email</h2>
          <p>Use this code to verify your email for your Rishikesh Homestays enquiry:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #14524a;">${code}</p>
          <p style="color: #666; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email — nothing has been sent yet.</p>
        </div>
      `
    });

    // The Resend SDK does not throw for API-level failures — it returns
    // { data, error } and resolves normally either way, so the error field
    // must be checked explicitly or a failed send silently looks like success.
    if (result.error) {
      console.error('OTP email send error (Resend API):', JSON.stringify(result.error));
      return res.status(500).json({ success: false, message: 'Could not send the verification code. Please try again.' });
    }

    console.log('✅ OTP email sent via Resend:', result.data);
    return res.json({ success: true, configured: true, token });
  } catch (error) {
    console.error('OTP email send error (exception):', error.message);
    return res.status(500).json({ success: false, message: 'Could not send the verification code. Please try again.' });
  }
}
