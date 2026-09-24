// Optional email verification for enquiry forms. Verification is
// informational only — it never blocks submitting the enquiry. If the
// backend isn't configured (no OTP_SECRET set), this silently does nothing
// and the email field behaves exactly as it did before.
import { setButtonLoading, clearButtonLoading } from './button-loading.js';
let otpConfigured = null;

async function checkConfigured() {
  if (otpConfigured !== null) return otpConfigured;
  try {
    const response = await fetch('/api/otp-status');
    const result = await response.json();
    otpConfigured = Boolean(result.configured);
  } catch {
    otpConfigured = false;
  }
  return otpConfigured;
}

// Attaches a "Verify" control next to the given email <input>. Returns a
// function `isVerified()` the caller can check at submit time — it only
// returns true if the currently-typed email still matches the one that was
// actually verified (editing the email after verifying resets it).
export async function setupEmailVerification(emailInput) {
  if (!emailInput) return () => false;

  const configured = await checkConfigured();
  if (!configured) return () => false;

  let verifiedEmail = null;
  let pendingToken = null;

  const wrapper = document.createElement('div');
  wrapper.className = 'email-otp';

  const verifyBtn = document.createElement('button');
  verifyBtn.type = 'button';
  verifyBtn.className = 'email-otp-btn';
  verifyBtn.textContent = 'Verify email';

  const codeRow = document.createElement('div');
  codeRow.className = 'email-otp-code-row';
  codeRow.hidden = true;

  const codeInput = document.createElement('input');
  codeInput.type = 'text';
  codeInput.inputMode = 'numeric';
  codeInput.maxLength = 6;
  codeInput.placeholder = '6-digit code';
  codeInput.className = 'email-otp-code-input';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'email-otp-btn';
  confirmBtn.textContent = 'Confirm';

  const statusEl = document.createElement('span');
  statusEl.className = 'email-otp-status';

  codeRow.append(codeInput, confirmBtn);
  wrapper.append(verifyBtn, codeRow, statusEl);
  emailInput.insertAdjacentElement('afterend', wrapper);

  function resetVerification() {
    if (verifiedEmail && verifiedEmail !== emailInput.value.trim()) {
      verifiedEmail = null;
      statusEl.textContent = '';
      verifyBtn.hidden = false;
      codeRow.hidden = true;
    }
  }

  emailInput.addEventListener('input', resetVerification);

  verifyBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    if (!email) {
      statusEl.textContent = 'Enter your email first.';
      return;
    }

    setButtonLoading(verifyBtn, 'Sending...');
    statusEl.textContent = '';

    try {
      const response = await fetch('/api/otp-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const result = await response.json();

      if (!result.success) {
        statusEl.textContent = result.message || 'Could not send the code.';
      } else {
        pendingToken = result.token;
        codeRow.hidden = false;
        statusEl.textContent = 'Code sent — check your inbox.';
      }
    } catch {
      statusEl.textContent = 'Could not send the code. Please try again.';
    } finally {
      clearButtonLoading(verifyBtn);
    }
  });

  confirmBtn.addEventListener('click', async () => {
    const code = codeInput.value.trim();
    if (!code || !pendingToken) return;

    setButtonLoading(confirmBtn, 'Verifying...');
    statusEl.textContent = '';

    try {
      const response = await fetch('/api/otp-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: pendingToken, code })
      });
      const result = await response.json();

      if (result.valid) {
        verifiedEmail = emailInput.value.trim();
        statusEl.textContent = '✅ Email verified';
        verifyBtn.hidden = true;
        codeRow.hidden = true;
      } else {
        statusEl.textContent = result.message || 'Incorrect code.';
      }
    } catch {
      statusEl.textContent = 'Could not verify the code. Please try again.';
    } finally {
      clearButtonLoading(confirmBtn);
    }
  });

  return () => verifiedEmail !== null && verifiedEmail === emailInput.value.trim();
}
