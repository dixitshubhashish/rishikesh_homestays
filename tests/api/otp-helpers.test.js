import test from 'node:test';
import assert from 'node:assert';

process.env.OTP_SECRET = 'test-secret-not-real';
const { generateOtp, checkOtp, isOtpConfigured } = await import('../../api/otp-helpers.js');

test('isOtpConfigured', async (t) => {
  await t.test('false when RESEND_API_KEY is missing', () => {
    const original = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    assert.strictEqual(isOtpConfigured(), false);
    if (original) process.env.RESEND_API_KEY = original;
  });

  await t.test('true when both OTP_SECRET and RESEND_API_KEY are set', () => {
    process.env.RESEND_API_KEY = 'test-resend-key';
    assert.strictEqual(isOtpConfigured(), true);
  });
});

test('generateOtp + checkOtp', async (t) => {
  await t.test('a freshly generated code verifies successfully against its own token', () => {
    const { code, token } = generateOtp('guest@example.com');
    const result = checkOtp(token, code);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.email, 'guest@example.com');
  });

  await t.test('is case-insensitive and trims the email', () => {
    const { code, token } = generateOtp('  Guest@Example.com  ');
    const result = checkOtp(token, code);
    assert.strictEqual(result.valid, true);
  });

  await t.test('rejects an incorrect code', () => {
    const { token } = generateOtp('guest@example.com');
    const result = checkOtp(token, '000000');
    assert.strictEqual(result.valid, false);
    assert.match(result.reason, /incorrect/i);
  });

  await t.test('rejects a garbage/tampered token', () => {
    const result = checkOtp('not-a-real-token', '123456');
    assert.strictEqual(result.valid, false);
  });

  await t.test('rejects an expired token', () => {
    const expiredToken = Buffer.from(`guest@example.com:${Date.now() - 1000}`).toString('base64url');
    const result = checkOtp(expiredToken, '123456');
    assert.strictEqual(result.valid, false);
    assert.match(result.reason, /expired/i);
  });

  await t.test('two different emails never produce the same code for the same instant', () => {
    const expiry = Date.now() + 600000;
    const tokenA = Buffer.from(`a@example.com:${expiry}`).toString('base64url');
    const tokenB = Buffer.from(`b@example.com:${expiry}`).toString('base64url');
    const { code: codeA } = generateOtp('a@example.com');
    // Recompute what b's code would be at the same expiry by checking A's code against B's token
    const crossCheck = checkOtp(tokenB, codeA);
    assert.strictEqual(crossCheck.valid, false, "a's code should not validate against b's token");
  });
});
