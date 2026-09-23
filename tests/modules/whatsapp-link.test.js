import test from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { isMobileDevice, buildWhatsAppLink, enhanceStaticWhatsAppLinks } from '../../assets/js/modules/whatsapp-link.js';

function setUserAgent(ua) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: ua },
    configurable: true
  });
}

test('isMobileDevice', async (t) => {
  await t.test('detects iPhone as mobile', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
    assert.strictEqual(isMobileDevice(), true);
  });

  await t.test('detects Android as mobile', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36');
    assert.strictEqual(isMobileDevice(), true);
  });

  await t.test('detects iPad as mobile', () => {
    setUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
    assert.strictEqual(isMobileDevice(), true);
  });

  await t.test('does not treat macOS desktop as mobile', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15');
    assert.strictEqual(isMobileDevice(), false);
  });

  await t.test('does not treat Windows desktop as mobile', () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    assert.strictEqual(isMobileDevice(), false);
  });
});

test('buildWhatsAppLink', async (t) => {
  await t.test('uses wa.me on mobile', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    const link = buildWhatsAppLink('919027212484', 'Hello there');
    assert.match(link, /^https:\/\/wa\.me\/919027212484\?text=/);
  });

  await t.test('uses web.whatsapp.com on desktop', () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    const link = buildWhatsAppLink('919027212484', 'Hello there');
    assert.match(link, /^https:\/\/web\.whatsapp\.com\/send\?phone=919027212484&text=/);
  });

  await t.test('strips non-digit characters from the phone number', () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    const link = buildWhatsAppLink('+91 90272-12484', 'Hi');
    assert.match(link, /phone=919027212484/);
  });

  await t.test('URL-encodes the message text', () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    const link = buildWhatsAppLink('919027212484', 'Line one\nLine two & more');
    assert.match(link, /text=Line%20one%0ALine%20two%20%26%20more/);
  });

  await t.test('handles an empty message without throwing', () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    assert.doesNotThrow(() => buildWhatsAppLink('919027212484', ''));
  });
});

test('enhanceStaticWhatsAppLinks', async (t) => {
  await t.test('rewrites a wa.me link with a pre-filled message, preserving phone and text', () => {
    const dom = new JSDOM(`
      <a id="hero" href="https://wa.me/918050091290?text=Hi%20there">Hero CTA</a>
    `);
    global.document = dom.window.document;
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');

    enhanceStaticWhatsAppLinks();

    const href = dom.window.document.getElementById('hero').href;
    assert.match(href, /^https:\/\/web\.whatsapp\.com\/send\?phone=918050091290&text=Hi%20there$/);
  });

  await t.test('rewrites a wa.me link with no query text at all', () => {
    const dom = new JSDOM(`
      <a id="footer-link" href="https://wa.me/918050091290">Footer WhatsApp</a>
    `);
    global.document = dom.window.document;
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');

    enhanceStaticWhatsAppLinks();

    const href = dom.window.document.getElementById('footer-link').href;
    assert.match(href, /^https:\/\/wa\.me\/918050091290\?text=$/);
  });

  await t.test('leaves non-wa.me links untouched', () => {
    const dom = new JSDOM(`
      <a id="other" href="https://example.com/contact">Contact</a>
    `);
    global.document = dom.window.document;

    assert.doesNotThrow(() => enhanceStaticWhatsAppLinks());
    assert.strictEqual(dom.window.document.getElementById('other').href, 'https://example.com/contact');
  });
});
