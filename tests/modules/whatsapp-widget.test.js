import test from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { setupWhatsAppWidget } from '../../assets/js/modules/whatsapp-widget.js';

// The "Book on WhatsApp" attention effect: turns black 15s after page load,
// fades black/green every 7s, and — unless the visitor has shown real
// intent (clicked it, opened the widget, or started typing into its form) —
// gives up 40s after that and leaves a short text hint behind instead of
// flashing forever at someone who's ignoring it.
const BTN_ATTENTION_DELAY_MS = 15000;
const BTN_ATTENTION_TIMEOUT_MS = 40000;
const ATTENTION_DELAY_MS = 15000;
const AUTO_OPEN_IDLE_MS = 15000;
const MANUAL_OPEN_IDLE_MS = 30000;
const RETURN_HINT_TIMEOUT_MS = 7000;

// Builds a fresh page, waits for it to actually reach 'complete' (jsdom
// dispatches DOMContentLoaded/load asynchronously, same as a real browser —
// the widget module only self-injects once that fires), then enables fake
// timers and boots the widget against it.
async function setup(t, { mobile = false } = {}) {
  const dom = new JSDOM(`
    <body>
      <div class="hero-actions">
        <a class="btn btn-whatsapp" href="https://wa.me/918050091290?text=hi">Book on WhatsApp</a>
      </div>
    </body>
  `, { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  // Node's own built-in `navigator` global (read-only, can't be reassigned)
  // reports a "Node.js/vX" user agent, which isMobileDevice() correctly
  // treats as non-mobile — good enough here without needing jsdom's version.
  // jsdom has no real rendering pipeline, so there's no native rAF — a
  // setTimeout(0)-based stand-in drives the hint's fade-in and, once fake
  // timers are enabled, resolves deterministically under tick(0).
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  // Node's `navigator` getter is configurable, so a mobile UA can be swapped
  // in for the mobile-flow tests and restored afterwards.
  const realNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  if (mobile) {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }
    });
    t.after(() => Object.defineProperty(globalThis, 'navigator', realNavigator));
  }

  // Real (unmocked) wait, on purpose — this settles jsdom's own readiness
  // timeline before we take over setTimeout for the widget's own delays.
  await new Promise((resolve) => setTimeout(resolve, 0));

  t.mock.timers.enable({ apis: ['setTimeout'] });
  setupWhatsAppWidget();
}

function getButton() {
  return document.querySelector('a.btn-whatsapp');
}

function getHint() {
  return document.querySelector('.whatsapp-btn-hint');
}

// Flushes the two nested requestAnimationFrame(setTimeout(0)) calls
// showWhatsAppButtonHint uses to trigger its fade-in transition.
function flushHintAnimationFrames(t) {
  t.mock.timers.tick(0);
  t.mock.timers.tick(0);
}

test('WhatsApp "Book on WhatsApp" button attention effect', async (t) => {
  await t.test('adds the attention effect after 15s', async (t) => {
    await setup(t);

    assert(!getButton().classList.contains('whatsapp-btn-attention'), 'should not start with the attention effect');
    t.mock.timers.tick(BTN_ATTENTION_DELAY_MS);
    assert(getButton().classList.contains('whatsapp-btn-attention'), 'should gain the attention effect at 15s');
  });

  await t.test('gives up and shows a hint after 40s of no activity', async (t) => {
    await setup(t);

    t.mock.timers.tick(BTN_ATTENTION_DELAY_MS);
    t.mock.timers.tick(BTN_ATTENTION_TIMEOUT_MS);
    flushHintAnimationFrames(t);

    assert(!getButton().classList.contains('whatsapp-btn-attention'), 'attention effect should stop once ignored long enough');
    const hint = getHint();
    assert(hint, 'a hint should appear once the attention effect gives up');
    assert(hint.classList.contains('is-visible'), 'the hint should fade in');
    assert(hint.textContent.length > 0, 'the hint should have some short info text');
  });

  await t.test('does not hide or hint if the button itself was clicked', async (t) => {
    await setup(t);

    t.mock.timers.tick(BTN_ATTENTION_DELAY_MS);
    const btn = getButton();
    // jsdom doesn't implement real navigation and logs a noisy (harmless)
    // error if a real <a href> click isn't prevented — this isn't testing
    // navigation, so suppress it the same way a real click handler would.
    btn.addEventListener('click', (e) => e.preventDefault());
    btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

    t.mock.timers.tick(BTN_ATTENTION_TIMEOUT_MS);
    flushHintAnimationFrames(t);

    assert(getButton().classList.contains('whatsapp-btn-attention'), 'a clicked button should keep the attention effect as-is');
    assert(!getHint(), 'a clicked button should not need the hint');
  });

  await t.test('does not hide or hint once the visitor starts typing into the widget form', async (t) => {
    await setup(t);

    t.mock.timers.tick(BTN_ATTENTION_DELAY_MS);
    const nameInput = document.getElementById('whatsapp-name');
    assert(nameInput, 'the widget form should be in the DOM once injected');
    nameInput.value = 'A';
    nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    t.mock.timers.tick(BTN_ATTENTION_TIMEOUT_MS);
    flushHintAnimationFrames(t);

    assert(getButton().classList.contains('whatsapp-btn-attention'), 'a visitor filling in the form is actively engaged — leave the button as-is');
    assert(!getHint(), 'no hint should appear while the visitor is filling in the form');
  });

  await t.test('does not hint once the visitor has opened the widget', async (t) => {
    await setup(t);

    t.mock.timers.tick(BTN_ATTENTION_DELAY_MS);
    document.getElementById('whatsapp-fab').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

    t.mock.timers.tick(BTN_ATTENTION_TIMEOUT_MS);
    flushHintAnimationFrames(t);

    assert(!getHint(), 'opening the widget directly is real intent — no need for a hint');
  });

  const nudge = () => document.getElementById('whatsapp-nudge');
  const popup = () => document.getElementById('whatsapp-popup');
  const click = (id) => document.getElementById(id).dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const typeName = () => {
    const input = document.getElementById('whatsapp-name');
    input.value = 'A';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  };

  // ---- Laptop/desktop: hint first, auto-open at 15s, idle-close after 15s more ----

  await t.test('desktop: shows a hint by the icon before the drawer opens', async (t) => {
    await setup(t);
    t.mock.timers.tick(ATTENTION_DELAY_MS - 1000);
    assert(!nudge().hidden, 'a hint should be visible during the first 15s');
    assert(popup().hidden, 'drawer should not be open yet');
  });

  await t.test('desktop: auto-opens the drawer at 15s', async (t) => {
    await setup(t);
    t.mock.timers.tick(ATTENTION_DELAY_MS);
    t.mock.timers.tick(0);
    assert(popup().classList.contains('is-open'), 'drawer should auto-open at 15s');
    assert(document.body.classList.contains('whatsapp-drawer-open'), 'page should make room for it');
    assert(nudge().hidden, 'the pre-open hint should go away once it opens');
  });

  await t.test('desktop: auto-opened drawer closes after 15s idle and shows a reopen hint', async (t) => {
    await setup(t);
    t.mock.timers.tick(ATTENTION_DELAY_MS);
    t.mock.timers.tick(0);
    t.mock.timers.tick(AUTO_OPEN_IDLE_MS);
    assert(!popup().classList.contains('is-open'), 'untouched drawer should close at 30s total');
    assert(!nudge().hidden);
    assert.match(nudge().textContent, /tap me anytime/i);
    t.mock.timers.tick(RETURN_HINT_TIMEOUT_MS);
    assert(nudge().hidden, 'reopen hint should disappear after a few seconds');
  });

  await t.test('desktop: auto-opened drawer stays open once the visitor starts typing', async (t) => {
    await setup(t);
    t.mock.timers.tick(ATTENTION_DELAY_MS);
    t.mock.timers.tick(0);
    typeName();
    t.mock.timers.tick(AUTO_OPEN_IDLE_MS + MANUAL_OPEN_IDLE_MS);
    assert(popup().classList.contains('is-open'), 'engaged drawer should remain open');
  });

  await t.test('desktop: manual close shows the reopen hint', async (t) => {
    await setup(t);
    t.mock.timers.tick(ATTENTION_DELAY_MS);
    t.mock.timers.tick(0);
    click('whatsapp-close');
    assert(!nudge().hidden, 'reopen hint should appear after a manual close');
    assert.match(nudge().textContent, /tap me anytime/i);
    t.mock.timers.tick(RETURN_HINT_TIMEOUT_MS);
    assert(nudge().hidden);
  });

  // ---- Mobile: hints only; opens on tap; idle-close with reopen hint ----

  await t.test('mobile: never opens by itself, only pulses and hints', async (t) => {
    await setup(t, { mobile: true });
    t.mock.timers.tick(ATTENTION_DELAY_MS);
    t.mock.timers.tick(MANUAL_OPEN_IDLE_MS);
    assert(popup().hidden, 'drawer must stay closed on mobile until tapped');
    assert(document.getElementById('whatsapp-fab').classList.contains('whatsapp-fab-pulse'));
  });

  await t.test('mobile: tapped-open drawer closes after idle and shows a reopen hint', async (t) => {
    await setup(t, { mobile: true });
    click('whatsapp-fab');
    t.mock.timers.tick(0);
    assert(popup().classList.contains('is-open'), 'tapping the icon should open it');
    t.mock.timers.tick(MANUAL_OPEN_IDLE_MS);
    assert(!popup().classList.contains('is-open'), 'untouched drawer should close');
    assert(!nudge().hidden);
    assert.match(nudge().textContent, /tap me anytime/i);
  });

  await t.test('mobile: tapped-open drawer stays open once the visitor starts typing', async (t) => {
    await setup(t, { mobile: true });
    click('whatsapp-fab');
    t.mock.timers.tick(0);
    typeName();
    t.mock.timers.tick(MANUAL_OPEN_IDLE_MS);
    assert(popup().classList.contains('is-open'));
  });
});
