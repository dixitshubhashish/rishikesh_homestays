#!/usr/bin/env node
// One-time (and any-time) setup of a machine for this repo and the booking-link search, the same command on macOS,
// Windows and Linux:   npm run setup         install only what is missing
//                      npm run setup -- --check    only report, install nothing
//                      npm run setup -- --all      also the spare Chrome (port 9222)
// Nothing that is already there is reinstalled or touched: every step first looks (a program on PATH, the browser's
// own install folder, a package folder in node_modules, Playwright's browser file) and says "ok" when it finds it.
// Installers: winget (Windows), Homebrew (macOS), a printed hint (Linux). It never reads or writes secrets (.env, credentials).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserSpecs, findExe } from './lib/browser-specs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIN = process.platform === 'win32', MAC = process.platform === 'darwin';
const CHECK = process.argv.includes('--check'), ALL = process.argv.includes('--all');
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', shell: WIN && /^(npm|npx)$/.test(cmd), ...opts });
const onPath = (cmd, args = ['--version']) => { const r = run(cmd, args, { stdio: 'ignore' }); return !r.error && r.status === 0; };

const rows = [];
let installFailed = false;
function report(name, state, note = '') { rows.push([name, state, note]); console.log(`${state.padEnd(10)} ${name}${note ? `  (${note})` : ''}`); }

// What each tool is called by each installer. `ok()` is the "is it already here" test.
const hasBrew = () => MAC && onPath('brew');
function install(name, { winget, brew, cask, hint }) {
  if (CHECK) { report(name, 'MISSING', 'run npm run setup to install'); return; }
  let r;
  if (WIN && winget) {
    if (!onPath('winget')) { report(name, 'MISSING', 'winget is missing: install "App Installer" from the Microsoft Store'); installFailed = true; return; }
    console.log(`installing ${name} with winget ...`);
    r = run('winget', ['install', '--id', winget, '--exact', '--silent', '--accept-source-agreements', '--accept-package-agreements'], { stdio: 'inherit' });
  } else if (MAC && (brew || cask)) {
    if (!hasBrew()) { report(name, 'MISSING', 'Homebrew is missing: install it from https://brew.sh, then run this again'); installFailed = true; return; }
    console.log(`installing ${name} with Homebrew ...`);
    r = run('brew', ['install', ...(cask ? ['--cask', cask] : [brew])], { stdio: 'inherit' });
  } else { report(name, 'MISSING', hint || 'install it with your package manager'); installFailed = true; return; }
  if (r.status === 0) report(name, 'installed'); else { report(name, 'FAILED', `exit ${r.status}`); installFailed = true; }
}

// ---- runtimes ------------------------------------------------------------------------------------------------------
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor >= 20) report('Node.js', 'ok', process.version); else report('Node.js', 'OLD', `${process.version}: version 20 or newer is needed`);

if (run(process.execPath, ['scripts/py.mjs', '--version'], { stdio: 'ignore' }).status === 0) report('Python 3', 'ok', run(process.execPath, ['scripts/py.mjs', '--version']).stdout.trim());
else install('Python 3', { winget: 'Python.Python.3.12', brew: 'python', hint: 'sudo apt install python3' });

if (onPath('git')) report('Git', 'ok'); else install('Git', { winget: 'Git.Git', brew: 'git', hint: MAC ? 'xcode-select --install' : 'sudo apt install git' });

// ---- browsers: the search drives Opera, Brave and Edge (Opera must stay in the set); Chrome is the optional spare ----
const CASK = { chrome: 'google-chrome', opera: 'opera', brave: 'brave-browser', edge: 'microsoft-edge' };
const WINGET = { chrome: 'Google.Chrome', opera: 'Opera.Opera', brave: 'Brave.Brave', edge: null };
const LABEL = { chrome: 'Google Chrome', opera: 'Opera', brave: 'Brave', edge: 'Microsoft Edge' };
for (const b of browserSpecs()) {
  if (!b.needed && !ALL) continue;
  const exe = findExe(b.exes);
  if (exe) { report(LABEL[b.name], 'ok', exe); continue; }
  if (WIN && b.name === 'edge') { report(LABEL.edge, 'MISSING', 'ships with Windows: run Windows Update'); installFailed = true; continue; }
  install(LABEL[b.name], { winget: WINGET[b.name], cask: CASK[b.name], hint: `install ${LABEL[b.name]} from its website` });
}

// ---- the repo's packages: a dependency folder missing from node_modules means `npm install` is due ----------------
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const wanted = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
const absent = wanted.filter((n) => !existsSync(path.join(ROOT, 'node_modules', ...n.split('/'), 'package.json')));
if (!absent.length) report('npm packages', 'ok', `${wanted.length} present`);
else if (CHECK) report('npm packages', 'MISSING', absent.join(', '));
else {
  console.log(`npm install (missing: ${absent.join(', ')}) ...`);
  const r = run('npm', ['install'], { stdio: 'inherit' });
  if (r.status === 0) report('npm packages', 'installed'); else { report('npm packages', 'FAILED'); installFailed = true; }
}

// ---- Playwright's own Chromium (verify_seen.mjs, the visual tests); it never searches ---------------------------------
let chromiumPath = '';
try { chromiumPath = (await import('playwright')).chromium.executablePath(); } catch { /* playwright not installed yet */ }
if (chromiumPath && existsSync(chromiumPath)) report('Playwright Chromium', 'ok');
else if (CHECK || !chromiumPath) report('Playwright Chromium', 'MISSING', CHECK ? 'run npm run setup' : 'npm packages first');
else {
  console.log('installing Playwright Chromium ...');
  const r = run('npx', ['playwright', 'install', 'chromium'], { stdio: 'inherit' });
  if (r.status === 0) report('Playwright Chromium', 'installed'); else { report('Playwright Chromium', 'FAILED'); installFailed = true; }
}

// ---- Windows: the lists are LF files, make Git leave them alone --------------------------------------------------
if (WIN && onPath('git')) {
  const cur = run('git', ['config', '--get', 'core.autocrlf']).stdout.trim();
  if (cur === 'false') report('git core.autocrlf', 'ok', 'false');
  else if (CHECK) report('git core.autocrlf', 'MISSING', `is "${cur || 'unset'}", should be false`);
  else { run('git', ['config', 'core.autocrlf', 'false']); report('git core.autocrlf', 'set', 'false'); }
}

const todo = rows.filter(([, s]) => ['MISSING', 'FAILED', 'OLD'].includes(s));
console.log(`\n${todo.length ? `${todo.length} item(s) need attention.` : 'This machine is ready.'}`
  + `${rows.some(([, s]) => s === 'installed') ? ' A new install may need a new terminal window to be found on PATH.' : ''}`);
if (!todo.length) console.log('Next: npm run search:browsers   (opens the search browsers in the background), then npm run search:start');
process.exit(todo.length || installFailed ? 1 : 0);
