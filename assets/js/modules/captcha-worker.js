// Web Worker for the proof-of-work captcha (assets/js/modules/captcha.js). A classic script on purpose, not a
// module: module workers are missing from older phones, and a same-origin file needs no `blob:` allowance in a
// Content-Security-Policy (`worker-src 'self'` is enough). It is self-contained for the same reason.
//
// In:  { salt, challenge, maxnumber }   Out: { number, took } (number is null when nothing in range matches).
// Finds the integer n in [0, maxnumber] with hex(sha256(salt + n)) === challenge (ALTCHA, SHA-256).
self.onmessage = async (event) => {
  const { salt, challenge, maxnumber } = event.data || {};
  const started = Date.now();
  try {
    const encoder = new TextEncoder();
    const target = new Uint8Array(32);
    for (let i = 0; i < 32; i += 1) target[i] = parseInt(String(challenge).slice(i * 2, i * 2 + 2), 16);
    for (let n = 0; n <= maxnumber; n += 1) {
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(salt + n)));
      let same = true;
      for (let i = 0; i < 32; i += 1) {
        if (hash[i] !== target[i]) {
          same = false;
          break;
        }
      }
      if (same) {
        self.postMessage({ number: n, took: Date.now() - started });
        return;
      }
    }
    self.postMessage({ number: null, took: Date.now() - started });
  } catch (error) {
    self.postMessage({ number: null, took: Date.now() - started, error: true });
  }
};
