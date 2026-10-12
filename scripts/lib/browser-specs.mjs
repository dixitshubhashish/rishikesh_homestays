// Where the search browsers are and how each one is told apart: one place, used by scripts/search-ctl.mjs (start, status, trim)
// and scripts/setup.mjs (what is installed). The same on macOS, Windows and Linux.
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const PLATFORM = process.platform;
const WIN = PLATFORM === 'win32';
const MAC = PLATFORM === 'darwin';

// ---- browsers: ports are the ones search_supervisor.mjs attaches to --------------------------------------------------

export function browserSpecs() {
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA || path.join(homedir(), 'AppData', 'Local');
  const mac = (app, bin) => [`/Applications/${app}.app/Contents/MacOS/${bin}`, path.join(homedir(), 'Applications', `${app}.app`, 'Contents', 'MacOS', bin)];
  // Chrome 136 and later ignore a debugging port on the everyday profile, so each browser gets its own profile folder
  const profiles = WIN ? path.join(local, 'rh-search')
    : MAC ? path.join(homedir(), 'Library', 'Application Support', 'rh-search')
      : path.join(process.env.XDG_DATA_HOME || path.join(homedir(), '.local', 'share'), 'rh-search');
  const exe = {
    chrome: WIN ? [`${pf}\\Google\\Chrome\\Application\\chrome.exe`, `${pf86}\\Google\\Chrome\\Application\\chrome.exe`, `${local}\\Google\\Chrome\\Application\\chrome.exe`]
      : MAC ? mac('Google Chrome', 'Google Chrome') : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'],
    opera: WIN ? [`${local}\\Programs\\Opera\\opera.exe`, `${pf}\\Opera\\opera.exe`]
      : MAC ? mac('Opera', 'Opera') : ['opera'],
    brave: WIN ? [`${pf}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`, `${local}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`]
      : MAC ? mac('Brave Browser', 'Brave Browser') : ['brave-browser', 'brave'],
    edge: WIN ? [`${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`, `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`]
      : MAC ? mac('Microsoft Edge', 'Microsoft Edge') : ['microsoft-edge', 'microsoft-edge-stable'],
  };
  // Incognito/private windows run without extensions (owner, 2026-10-07: saves their memory); the profile folder only holds the debugging session.
  // The supervisor runs workers on Opera, Edge, Brave and Chrome; Chrome is opened only with --all. On macOS, Firefox runs headless under Playwright.
  // Edge stays a normal window (extensions off): in an InPrivate window the workers never see the tabs they open (tested 2026-10-07).
  const privateFlag = { chrome: '--incognito', brave: '--incognito', opera: '--private', edge: '' };
  // Second independent instance of each engine (owner, 2026-10-12: double automation capacity). Same installed app,
  // a second launch with its own --user-data-dir and --remote-debugging-port; Chrome-family browsers run two such
  // instances fine side by side. Each gets its own profile folder so it never touches the first instance's cookies
  // or challenge state, and its own fixed port so it comes up (or stays down) independently — in particular brave2
  // must never depend on brave1 (port 9224) being up. These are still dedicated rh-search automation profiles, never
  // the owner's personal everyday browser windows.
  const base = [['chrome', 9222, false], ['opera', 9223, true], ['brave', 9224, true], ['edge', 9225, true]];
  const second = [['chrome2', 9226, false], ['opera2', 9227, true], ['brave2', 9228, true], ['edge2', 9229, true]];
  return [...base, ...second].map(([name, port, needed]) => {
    const engine = name.replace(/2$/, '');
    return { name, port, needed, exes: exe[engine], profile: path.join(profiles, name), privateFlag: privateFlag[engine] };
  });
}

// An absolute candidate must exist; a bare name (Linux) is looked up on PATH.
export function findExe(candidates) {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const c of candidates) {
    if (path.isAbsolute(c)) { if (existsSync(c)) return c; continue; }
    for (const d of dirs) { const p = path.join(d, c); if (existsSync(p)) return p; }
  }
  return '';
}
