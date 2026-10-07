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
  // The supervisor runs workers on Opera, Edge and Brave; Chrome is a spare (opened only with --all): a fourth browser costs about 1 GB.
  // Edge stays a normal window (extensions off): in an InPrivate window the workers never see the tabs they open (tested 2026-10-07).
  const privateFlag = { chrome: '--incognito', brave: '--incognito', opera: '--private', edge: '' };
  return [['chrome', 9222, false], ['opera', 9223, true], ['brave', 9224, true], ['edge', 9225, true]]
    .map(([name, port, needed]) => ({ name, port, needed, exes: exe[name], profile: path.join(profiles, name), privateFlag: privateFlag[name] }));
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

