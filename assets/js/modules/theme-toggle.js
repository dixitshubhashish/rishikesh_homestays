// Dark/light theme switch. The inline snippet in every page's <head> sets
// <html data-theme> before the first paint (from localStorage 'rh-theme',
// light while nothing is stored); this module wires the header button
// ([data-theme-toggle]) and keeps aria-pressed, color-scheme and the
// theme-color meta in step. Colours live in styles.css: the light values on
// :root, the dark ones under :root[data-theme="dark"] at the end of the file.
//
// Phase 1 (now): opt-in, the site is light until a visitor picks dark.
// Phase 2 (after the owner's screenshot review): set FOLLOW_SYSTEM to true and,
// in the head snippet, replace the fallback `t='light'` with
// `t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'`.
export const FOLLOW_SYSTEM = false;
export const STORAGE_KEY = 'rh-theme';
export const THEME_COLORS = { light: '#fbfaf5', dark: '#0f1715' };

const root = () => document.documentElement;

export function currentTheme() {
  return root().getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

// The stored choice, or null; storage can throw (private mode, blocked site data).
export function storedTheme() {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    return t === 'dark' || t === 'light' ? t : null;
  } catch {
    return null;
  }
}

function systemTheme() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function syncButtons(theme) {
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  });
}

export function applyTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  root().setAttribute('data-theme', t);
  root().style.colorScheme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[t]);
  syncButtons(t);
  document.dispatchEvent(new CustomEvent('rh-themechange', { detail: { theme: t } }));
  return t;
}

export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* not remembered, but still switched for this page */
  }
  return applyTheme(next);
}

export function setupThemeToggle() {
  syncButtons(currentTheme());
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    if (btn.dataset.themeReady) return;
    btn.dataset.themeReady = '1';
    btn.addEventListener('click', toggleTheme);
  });
  if (FOLLOW_SYSTEM && window.matchMedia) {
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (!storedTheme()) applyTheme(systemTheme());
      });
    } catch {
      /* old browsers without addEventListener on MediaQueryList */
    }
  }
}
