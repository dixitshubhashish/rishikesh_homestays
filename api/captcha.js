// Self-hosted proof-of-work captcha in the ALTCHA protocol (MIT, altcha.org):
// no third party, no cookies, no tracking. The server hands out a signed
// challenge (find n in [0, maxnumber] with sha256(salt + n) == challenge); the
// browser solves it (assets/js/modules/captcha.js) and sends the result as the
// base64 JSON payload the ALTCHA widget itself produces, in the "captcha"
// field of a POST. altcha-lib/v1 is the protocol the widget speaks (the
// package's default export is the newer v2 format, which is not used here).
//
// CAPTCHA_SECRET empty = captcha off: nothing is enforced and the client
// skips the step, so deploying before the variable is set breaks no form.
import 'dotenv/config';
import { timingSafeEqual } from 'node:crypto';
import { createChallenge, extractParams } from 'altcha-lib/v1';

export const CAPTCHA_FAILED_CODE = 'captcha_failed';
export const CAPTCHA_FAILED_MESSAGE = 'We could not verify that you are not a bot. Please try again.';

// A challenge is valid for 5 minutes (the expiry is inside the signed salt).
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
// Difficulty: on average half of this many SHA-256 hashes, well under a second
// for a browser Worker, and a real (if small) cost per bot request.
export const MAX_NUMBER = 50_000;
const ALGORITHM = 'SHA-256';
const MAX_PAYLOAD_LENGTH = 2048;
const HEX64 = /^[0-9a-f]{64}$/;
const BASE64 = /^[A-Za-z0-9+/_-]+={0,2}$/;

export const isCaptchaConfigured = () => Boolean(String(process.env.CAPTCHA_SECRET || '').trim());
const secret = () => String(process.env.CAPTCHA_SECRET || '').trim();

// Single-use, best effort: challenges already redeemed, kept until their own
// expiry. Serverless instances do not share this memory, so a payload could be
// replayed once against a different instance within its 5 minutes; the HMAC,
// the expiry and the proof-of-work cost are what actually hold the line.
const USED_CAP = 10_000;
const used = new Map(); // challenge -> expiry (ms)

function markUsed(challenge, expiresMs) {
  const now = Date.now();
  if (used.has(challenge)) return false;
  if (used.size >= USED_CAP) {
    for (const [key, expiry] of used) if (expiry <= now) used.delete(key);
    // Still full of live entries (a flood): drop the oldest, Map keeps insertion order.
    while (used.size >= USED_CAP) used.delete(used.keys().next().value);
  }
  used.set(challenge, expiresMs);
  return true;
}

// For tests: forget every redeemed challenge.
export function resetCaptchaState() {
  used.clear();
}

let warned = false;
function warnOnce() {
  if (warned) return;
  warned = true;
  console.warn('⚠️  CAPTCHA_SECRET is not set: the captcha is OFF and every form is accepted without a check.');
}

// The challenge the browser must solve; null when the captcha is off.
export async function buildChallenge() {
  if (!isCaptchaConfigured()) return null;
  return createChallenge({
    algorithm: ALGORITHM,
    hmacKey: secret(),
    maxnumber: MAX_NUMBER,
    expires: new Date(Date.now() + CHALLENGE_TTL_MS)
  });
}

function parsePayload(payload) {
  if (typeof payload !== 'string' || !payload || payload.length > MAX_PAYLOAD_LENGTH || !BASE64.test(payload)) return null;
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const { algorithm, challenge, number, salt, signature } = parsed;
  if (algorithm !== ALGORITHM) return null;
  if (typeof challenge !== 'string' || !HEX64.test(challenge)) return null;
  if (typeof signature !== 'string' || !HEX64.test(signature)) return null;
  if (typeof salt !== 'string' || !salt || salt.length > 256) return null;
  if (!Number.isInteger(number) || number < 0 || number > MAX_NUMBER) return null;
  return { algorithm, challenge, number, salt, signature };
}

const sameHex = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));

// True when the payload is a valid, unexpired, not-yet-used solution of a
// challenge this server signed, or when the captcha is off. Never logs the
// secret or the payload.
export async function verifyCaptcha(payload) {
  if (!isCaptchaConfigured()) {
    warnOnce();
    return true;
  }
  const solution = parsePayload(payload);
  if (!solution) return false;

  // The expiry travels inside the salt (signed through the challenge hash).
  const expires = Number(extractParams({ salt: solution.salt }).expires);
  if (!Number.isFinite(expires) || expires * 1000 <= Date.now()) return false;

  try {
    // Recompute the challenge and its signature from the claimed number; a
    // tampered salt, number or signature cannot reproduce them without the secret.
    const check = await createChallenge({
      algorithm: ALGORITHM,
      hmacKey: secret(),
      number: solution.number,
      salt: solution.salt
    });
    if (!sameHex(check.challenge, solution.challenge) || !sameHex(check.signature, solution.signature)) return false;
  } catch {
    return false;
  }
  // Check and mark in one synchronous step: two requests racing with the same
  // payload cannot both pass.
  return markUsed(solution.challenge, expires * 1000);
}
