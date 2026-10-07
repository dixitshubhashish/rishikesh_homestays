#!/usr/bin/env node
// Starts, checks and stops the booking-link search, the same way on macOS, Windows and Linux
// (docs/booking-links/RULES.md section 5). The npm scripts are the one way to run it:
//   npm run search:browsers   open the four browsers with their debugging ports (Chrome 9222, Opera 9223, Brave 9224, Edge 9225)
//   npm run search:start      start the supervisor (it starts and watches one worker per browser) and keep the machine awake
//   npm run search:status     supervisor and worker pids, ports, found/unfound/review counts, the last supervisor lines
//   npm run search:stop       stop the supervisor FIRST, then every worker, then verify nothing is left
// Only ONE machine may run the search at a time, and nobody edits docs/booking-links/*.tsv by hand while it runs.
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, closeSync, readSync, statSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLATFORM = process.platform;
const WIN = PLATFORM === 'win32';
const MAC = PLATFORM === 'darwin';
const LOGS = path.join(ROOT, 'scripts', 'stays', '.cache', 'booking-search-2026-10-04');
const LISTS = path.join(ROOT, 'docs', 'booking-links');
// the five gitignored files the search reads (RULES.md section 5, "Move it over")
const CACHE = ['stays.json', 'haridwar/stays.json', 'places/places.json', 'places/all-stays.json', 'places/ota-links.tsv']
  .map((f) => path.join(ROOT, 'scripts', 'stays', '.cache', ...f.split('/')));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

// ---- browsers: ports are the ones search_supervisor.mjs attaches to --------------------------------------------------

function browserSpecs() {
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
  return [['chrome', 9222], ['opera', 9223], ['brave', 9224], ['edge', 9225]]
    .map(([name, port]) => ({ name, port, exes: exe[name], profile: path.join(profiles, name) }));
}

// An absolute candidate must exist; a bare name (Linux) is looked up on PATH.
function findExe(candidates) {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const c of candidates) {
    if (path.isAbsolute(c)) { if (existsSync(c)) return c; continue; }
    for (const d of dirs) { const p = path.join(d, c); if (existsSync(p)) return p; }
  }
  return '';
}

// Same host the workers' --attach URLs use (localhost), so "answers" means what the workers will see.
async function listening(port) {
  try { return (await fetch(`http://localhost:${port}/json/version`, { signal: AbortSignal.timeout(2000) })).ok; } catch { return false; }
}

// ---- the search's own processes -------------------------------------------------------------------------------------

// The script must be the node process's first argument: `node --check scripts/stays/search_supervisor.mjs` or an editor
// that merely mentions the name is never matched, and neither is this script.
const SEARCH_CMD = /^(?:"[^"]*"|\S+)\s+"?(?:\S*[\\/])?scripts[\\/]stays[\\/](search_supervisor|google_ota_search)\.mjs"?(\s|$)/;

// [{ pid, cmd, kind: 'supervisor' | 'worker' }]
function searchProcesses() {
  let rows;
  if (WIN) {
    // PowerShell, not wmic (gone from Windows 11 24H2); execFile so no cmd.exe quoting gets in the way
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' } | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"],
    { encoding: 'utf8', windowsHide: true });
    rows = [].concat(JSON.parse(out.trim() || '[]')).map((r) => ({ pid: r.ProcessId, cmd: r.CommandLine || '' }));
  } else {
    // `ps -axo pid=,command=` is the same on macOS and Linux (pgrep -fl prints only the name on older Linux)
    const out = execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    rows = out.split(/\r?\n/).map((l) => l.match(/^\s*(\d+)\s+(.*)$/)).filter(Boolean).map((m) => ({ pid: Number(m[1]), cmd: m[2] }));
  }
  return rows.filter((r) => r.pid !== process.pid).flatMap((r) => {
    const m = SEARCH_CMD.exec(r.cmd);
    return m ? [{ ...r, kind: m[1] === 'search_supervisor' ? 'supervisor' : 'worker' }] : [];
  });
}

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

// ---- status ---------------------------------------------------------------------------------------------------------

// The supervisor's log: its own name per machine (RULES.md), the newer one when both exist.
function supervisorLog() {
  const own = path.join(LOGS, WIN ? 'supervisor-windows.log' : 'supervisor.log');
  const other = path.join(LOGS, WIN ? 'supervisor.log' : 'supervisor-windows.log');
  const have = [own, other].filter(existsSync);
  return have.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] || own;
}

function tailLines(file, n) {
  try {
    const size = statSync(file).size, len = Math.min(size, 16384);
    const buf = Buffer.alloc(len), fd = openSync(file, 'r');
    try { readSync(fd, buf, 0, len, size - len); } finally { closeSync(fd); }
    return buf.toString('utf8').split(/\r?\n/).filter(Boolean).slice(-n);
  } catch { return []; }
}

const rowCount = (f) => { try { return readFileSync(path.join(LISTS, f), 'utf8').split(/\r?\n/).filter(Boolean).length - 1; } catch { return 'missing'; } };

async function status() {
  const procs = searchProcesses();
  const sup = procs.filter((p) => p.kind === 'supervisor');
  console.log('supervisor:', sup.length ? sup.map((p) => p.pid).join(', ') : 'not running');
  const workers = procs.filter((p) => p.kind === 'worker');
  for (const p of workers) {
    const shard = /--shard (\S+)/.exec(p.cmd)?.[1], attach = /--attach (\w+)=/.exec(p.cmd)?.[1];
    const flags = ['--deep', '--reverse', '--review'].filter((f) => p.cmd.includes(f)).join(' ');
    console.log(`  worker ${p.pid}: ${attach || '?'} shard ${shard || '?'} ${flags}`.trimEnd());
  }
  if (!workers.length) console.log('  no workers');
  const ports = await Promise.all(browserSpecs().map(async (b) => `${b.name} ${b.port} ${await listening(b.port) ? 'ready' : 'NOT answering'}`));
  console.log('browsers:', ports.join(', '));
  for (const f of ['found', 'unfound', 'review']) console.log(`  ${f.padEnd(8)}${rowCount(`${f}.tsv`)} rows`);
  const log = supervisorLog();
  const lines = tailLines(log, 6);
  if (lines.length) { console.log(`last lines of ${rel(log)}:`); for (const l of lines) console.log(`  ${l}`); }
}

// ---- browsers -------------------------------------------------------------------------------------------------------

async function browsers() {
  const specs = browserSpecs();
  for (const b of specs) {
    if (await listening(b.port)) { console.log(`${b.name}: already listening on ${b.port}`); continue; }
    const exe = findExe(b.exes);
    if (!exe) { console.log(`${b.name}: NOT INSTALLED${WIN ? ' (run scripts\\windows\\setup.ps1)' : ''}`); continue; }
    mkdirSync(b.profile, { recursive: true });
    // detached and unref'd: the browser must outlive this command. Node quotes an argument that holds spaces itself.
    const child = spawn(exe, [`--remote-debugging-port=${b.port}`, `--user-data-dir=${b.profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'],
      { detached: true, stdio: 'ignore' });
    child.on('error', (e) => console.log(`${b.name}: could not start (${e.message})`));
    child.unref();
    console.log(`${b.name}: started on port ${b.port} (profile ${b.profile})`);
  }
  await sleep(5000);
  let missing = 0;
  for (const b of specs) {
    const ok = await listening(b.port);
    if (!ok) missing++;
    console.log(`${b.name.padEnd(7)} port ${b.port}: ${ok ? 'ready' : 'NOT answering'}`);
  }
  console.log('\nFirst time: in each browser open google.com once and accept cookies; sign in if you like. Then: npm run search:start');
  return missing ? 1 : 0;
}

// ---- start ----------------------------------------------------------------------------------------------------------

async function start() {
  const running = searchProcesses().filter((p) => p.kind === 'supervisor');
  if (running.length) { console.log('the supervisor is already running'); await status(); return 0; }
  const missing = CACHE.filter((f) => !existsSync(f));
  if (missing.length) {
    console.error(`not starting: the search cache is missing (${missing.map(rel).join(', ')}).\n` +
      'Unpack rh-search-cache.tgz from the machine that ran the search (docs/booking-links/RULES.md section 5), or rebuild it there.\n' +
      'Another machine may still be running the search: only one may at a time.');
    return 1;
  }
  const down = [];
  for (const b of browserSpecs()) if (!await listening(b.port)) down.push(`${b.name} (${b.port})`);
  if (down.length) { console.error(`not starting: no browser answers on ${down.join(', ')}. Run: npm run search:browsers`); return 1; }

  mkdirSync(LOGS, { recursive: true });
  const logFile = supervisorLog();
  // keep the machine awake while it runs: Windows with the charger in (no sleep, the screen may switch off), macOS for as long as the supervisor lives (-i also on battery, -s on the charger)
  if (WIN) spawnSync('powercfg', ['/change', 'standby-timeout-ac', '0'], { windowsHide: true, stdio: 'ignore' });
  const fd = openSync(logFile, 'a');
  // relative path + cwd, like the workers: ps then shows `node scripts/stays/search_supervisor.mjs` whatever the checkout path (spaces included)
  const child = spawn(process.execPath, ['scripts/stays/search_supervisor.mjs'], { cwd: ROOT, detached: true, windowsHide: true, stdio: ['ignore', fd, fd] });
  child.unref();
  closeSync(fd);
  if (MAC) spawn('caffeinate', ['-i', '-s', '-w', String(child.pid)], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  console.log(`supervisor started, pid ${child.pid}; log ${rel(logFile)}`);
  await sleep(8000);
  await status();
  return 0;
}

// ---- stop -----------------------------------------------------------------------------------------------------------

function kill(pid, signal) { try { process.kill(pid, signal); } catch { /* gone already */ } }

async function stop() {
  const first = searchProcesses();
  if (!first.length) { console.log('stopped: no supervisor and no worker running'); return 0; }
  // the supervisor first, or it restarts the workers we are stopping. The lists are written to a temp file and renamed
  // (google_ota_search.mjs), so even a hard kill never leaves half a list. On Windows any signal is TerminateProcess.
  for (const p of first.filter((x) => x.kind === 'supervisor')) kill(p.pid, 'SIGTERM');
  await sleep(1000);
  // scan again: a worker the supervisor started just before it died is not in `first`
  const workers = new Map([...first, ...searchProcesses()].filter((x) => x.kind === 'worker').map((x) => [x.pid, x]));
  for (const p of workers.values()) kill(p.pid, 'SIGTERM');
  let left = first;
  for (let i = 0; i < 16; i++) { // up to ~8 s for the workers' own shutdown
    await sleep(500);
    left = searchProcesses();
    if (!left.length) break;
  }
  if (left.length && !WIN) { for (const p of left) kill(p.pid, 'SIGKILL'); await sleep(1000); left = searchProcesses(); }
  if (left.length) { console.error(`STILL RUNNING: ${left.map((p) => `${p.kind} ${p.pid}`).join(', ')}`); return 1; }
  console.log('stopped: no supervisor and no worker left');
  return 0;
}

// ---- main -----------------------------------------------------------------------------------------------------------

const COMMANDS = { browsers, start, status: async () => { await status(); return 0; }, stop };
const cmd = process.argv[2];
if (!COMMANDS[cmd]) {
  console.error('usage: node scripts/search-ctl.mjs browsers | start | status | stop   (npm run search:browsers|start|status|stop)');
  process.exit(2);
}
try { process.exit(await COMMANDS[cmd]()); } catch (e) { console.error(e.message); process.exit(1); }
