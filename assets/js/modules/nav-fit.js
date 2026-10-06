// Keeps the desktop nav (links, "Plan my stay", language and theme buttons) on
// one row in every language. Translated labels run up to ~1.6x the English
// (Tamil, Telugu, Kannada), so when the header row overflows its width the nav
// text steps down (--nav-fit, read by styles.css) until it fits, at most to
// MIN. Re-checked on resize and whenever the nav's text changes (the in-browser
// translation swaps it after load). The phone drawer (≤1380px) is untouched.

const DESKTOP = '(min-width: 1381px)';
const STEPS = [1, 0.94, 0.88, 0.82, 0.77, 0.72];

export function setupNavFit(doc = document, win = window) {
  const wrap = doc.querySelector('.site-header .nav-wrap');
  const nav = wrap?.querySelector('.site-nav');
  if (!wrap || !nav || !win.matchMedia) return;
  const root = doc.documentElement;

  const overflows = () => wrap.scrollWidth > wrap.clientWidth + 1;
  const fit = () => {
    if (!win.matchMedia(DESKTOP).matches) { root.style.removeProperty('--nav-fit'); return; }
    for (const step of STEPS) {
      root.style.setProperty('--nav-fit', String(step));
      if (!overflows()) return;
    }
  };

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    win.requestAnimationFrame(() => { queued = false; fit(); });
  };
  fit();
  win.addEventListener('resize', schedule);
  doc.fonts?.ready?.then(schedule);
  if (typeof win.MutationObserver === 'function') {
    new win.MutationObserver(schedule).observe(nav, { subtree: true, childList: true, characterData: true });
  }
}
