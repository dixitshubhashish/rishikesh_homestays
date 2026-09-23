import { createHmac } from 'crypto';

// Stateless email OTP: the code is deterministically derived from
// HMAC(secret, email + expiry), so nothing needs to be stored server-side
// between the "send" and "verify" calls — important since Vercel functions
// are stateless/ephemeral and an in-memory store wouldn't reliably persist
// across separate invocations.
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function isOtpConfigured() {
  return Boolean(process.env.OTP_SECRET && process.env.RESEND_API_KEY);
}

function deriveCode(email, expiry) {
  const hmac = createHmac('sha256', process.env.OTP_SECRET)
    .update(`${email.toLowerCase().trim()}:${expiry}`)
    .digest('hex');
  const num = parseInt(hmac.slice(0, 8), 16) % 1000000;
  return String(num).padStart(6, '0');
}

export function generateOtp(email) {
  const expiry = Date.now() + CODE_TTL_MS;
  const code = deriveCode(email, expiry);
  const token = Buffer.from(`${email.toLowerCase().trim()}:${expiry}`).toString('base64url');
  return { code, token };
}

export function checkOtp(token, submittedCode) {
  let decoded;
  try {
    decoded = Buffer.from(String(token), 'base64url').toString('utf8');
  } catch {
    return { valid: false, reason: 'Invalid or expired verification session.' };
  }
  const [email, expiryStr] = decoded.split(':');
  const expiry = Number(expiryStr);
  if (!email || !expiry) return { valid: false, reason: 'Invalid or expired verification session.' };
  if (Date.now() > expiry) return { valid: false, reason: 'This code has expired. Please request a new one.' };

  const expectedCode = deriveCode(email, expiry);
  if (String(submittedCode).trim() !== expectedCode) {
    return { valid: false, reason: 'Incorrect code. Please check and try again.' };
  }
  return { valid: true, email };
}
