#!/usr/bin/env node
// Starts, checks and stops the booking-link search, the same way on macOS, Windows and Linux
// (docs/booking-links/RULES.md section 5). The npm scripts are the one way to run it:
//   npm run search:browsers   open the search browsers with their debugging ports, in incognito/private mode with extensions off
//                             (Opera 9223 and Brave 9224 private, Edge 9225 normal window with extensions off; Chrome 9222 only with --all: the supervisor runs three workers)
//   npm run search:start      start the supervisor (it starts and watches one worker per browser) and keep the machine awake
//   npm run search:status     supervisor and worker pids, ports, found/unfound/review counts, the last supervisor lines
//   npm run search:stop       stop the supervisor FIRST, then every worker, then verify nothing is left (--close-browsers also closes the search browsers)
//   node scripts/search-ctl.mjs trim   memory rule: close every browser that is not a search browser (--all: the search browsers too, --dry: list only)
// Only ONE machine may run the search at a time, and nobody edits docs/booking-links/*.tsv by hand while it runs.
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, closeSync, readSync, statSync, readFileSync } from 'node:fs';
import { browserSpecs, findExe } from './lib/browser-specs.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLATFORM = process.platform;
const WIN = PLATFORM === 'win32';
const MAC = PLATFORM === 'darwin';
const LOGS = path.join(ROOT, 'scripts', 'stays', '.cache', 'booking-search-2026-10-04');
const LISTS = path.join(ROOT, 'docs', 'booking-links');
// the six gitignored files the search reads (RULES.md section 5, "Move it over"; phones.json feeds push_places.mjs)
const CACHE = ['stays.json', 'haridwar/stays.json', 'places/places.json', 'places/all-stays.json', 'places/ota-links.tsv', 'places/phones.json']
  .map((f) => path.join(ROOT, 'scripts', 'stays', '.cache', ...f.split('/')));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

// ---- browsers: ports are the ones search_supervisor.mjs attaches to (scripts/lib/browser-specs.mjs) --------------------

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
  const ports = await Promise.all(browserSpecs().map(async (b) => { const up = await listening(b.port); return up || b.needed ? `${b.name} ${b.port} ${up ? 'ready' : 'NOT answering'}` : ''; }));
  console.log('browsers:', ports.filter(Boolean).join(', '));
  for (const f of ['found', 'unfound', 'review']) console.log(`  ${f.padEnd(8)}${rowCount(`${f}.tsv`)} rows`);
  const log = supervisorLog();
  const lines = tailLines(log, 6);
  if (lines.length) { console.log(`last lines of ${rel(log)}:`); for (const l of lines) console.log(`  ${l}`); }
}

// ---- browsers -------------------------------------------------------------------------------------------------------

// Starts a browser without stealing focus, and so that it outlives this command:
//   macOS    `open -g -j -n`: -g stays behind the app in use, -j launches it hidden, -n a new instance (our own profile folder)
//   Windows  Start-Process -WindowStyle Minimized (minimized, never activated)
//   Linux    detached, with --start-minimized
function launchInBackground(exe, args) {
  try {
    if (MAC) {
      const app = exe.slice(0, exe.indexOf('.app/') + 4);
      spawn('open', ['-g', '-j', '-n', '-a', app, '--args', ...args], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
    } else if (WIN) {
      const q = (x) => `'${String(x).replace(/'/g, "''")}'`;
      spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command',
        `Start-Process -FilePath ${q(exe)} -ArgumentList ${args.map(q).join(',')} -WindowStyle Minimized`],
      { detached: true, stdio: 'ignore', windowsHide: true }).on('error', () => {}).unref();
    } else {
      spawn(exe, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
    }
    return '';
  } catch (e) { return e.message; }
}

// macOS: Chromium browsers ignore `open -g -j` and show themselves, so once they listen each search browser's app is hidden
// (Cmd-H: the windows and their tabs keep running, the debugging port keeps answering) and focus goes back to what you were using.
function hideMacBrowsers(specs) {
  if (!MAC) return;
  const out = execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  for (const b of specs) {
    const main = out.split('\n').map((l) => l.match(/^\s*(\d+)\s+(.*)$/)).filter(Boolean)
      .find((m) => m[2].includes(`--remote-debugging-port=${b.port}`) && m[2].includes('rh-search') && !m[2].includes(' --type='));
    if (!main) continue;
    try { execFileSync('osascript', ['-e', `tell application "System Events" to set visible of (first process whose unix id is ${main[1]}) to false`], { stdio: 'ignore', timeout: 10000 }); }
    catch { console.log(`${b.name}: could not hide its window (allow Terminal / your editor under System Settings > Privacy & Security > Automation > System Events)`); }
  }
}

async function browsers() {
  const specs = browserSpecs().filter((b) => b.needed || process.argv.includes('--all'));
  for (const b of specs) {
    if (await listening(b.port)) { console.log(`${b.name}: already listening on ${b.port}`); continue; }
    const exe = findExe(b.exes);
    if (!exe) { console.log(`${b.name}: NOT INSTALLED${WIN ? ' (run scripts\\windows\\setup.ps1)' : ''}`); continue; }
    mkdirSync(b.profile, { recursive: true });
    // background only (owner, 2026-10-08): the window never takes focus from what you are doing
    const args = [`--remote-debugging-port=${b.port}`, `--user-data-dir=${b.profile}`, ...(b.privateFlag ? [b.privateFlag] : []), '--disable-extensions', '--no-first-run', '--no-default-browser-check', '--start-minimized', 'https://www.google.com/'];
    const err = launchInBackground(exe, args);
    if (err) { console.log(`${b.name}: could not start (${err})`); continue; }
    console.log(`${b.name}: started on port ${b.port}${b.privateFlag ? ', private window' : ''}, extensions off (profile ${b.profile})`);
  }
  await sleep(5000);
  hideMacBrowsers(specs);
  let missing = 0;
  for (const b of specs) {
    const ok = await listening(b.port);
    if (!ok) missing++;
    console.log(`${b.name.padEnd(7)} port ${b.port}: ${ok ? 'ready' : 'NOT answering'}`);
  }
  console.log('\nEach browser opens google.com: accept its cookie banner once (a private window forgets it when closed). Then: npm run search:start');
  return missing ? 1 : 0;
}

// A browser left with no window (search:stop closes the workers' tabs; Edge then keeps running with none) refuses the workers'
// connection ("Browser context management is not supported"): give each such browser one blank tab before the search starts.
async function ensureWindows(specs) {
  for (const b of specs) {
    try {
      const list = await (await fetch(`http://localhost:${b.port}/json/list`, { signal: AbortSignal.timeout(3000) })).json();
      if (list.some((t) => t.type === 'page')) continue;
      await fetch(`http://localhost:${b.port}/json/new?https://www.google.com/`, { method: 'PUT', signal: AbortSignal.timeout(5000) });
      console.log(`${b.name}: had no window, opened one`);
    } catch { /* the port check below reports a browser that does not answer */ }
  }
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
  // without the directory stays the pins, names and duplicate checks silently run on Google places alone
  const empty = CACHE.slice(0, 2).filter((f) => { try { return JSON.parse(readFileSync(f, 'utf8')).length < 100; } catch { return true; } });
  if (empty.length) { console.error(`not starting: ${empty.map(rel).join(', ')} holds no stays yet (the crawl and process.py must finish: node scripts/py.mjs scripts/stays/crawl.py; process.py, then --city haridwar).`); return 1; }
  const down = [];
  for (const b of browserSpecs().filter((x) => x.needed || x.name === 'chrome')) if (!await listening(b.port)) { if (b.needed) down.push(`${b.name} (${b.port})`); }
  await ensureWindows(browserSpecs().filter((x) => x.needed || x.name === 'chrome'));
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
  if (!first.length) { console.log('stopped: no supervisor and no worker running'); if (process.argv.includes('--close-browsers')) await trim(['--all']); return 0; }
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
  if (process.argv.includes('--close-browsers')) await trim(['--all']);
  return 0;
}

// ---- trim: the memory rule ------------------------------------------------------------------------------------------
// Owner, 2026-10-07: "I don't need any browser for myself", so when memory is short every browser that is not a search
// browser is closed (the owner's own windows included); --all closes the search browsers as well (search:stop
// --close-browsers); --dry only lists. A search browser = a browser started with a debugging port and our rh-search profile,
// plus everything below it in the process tree. Claude Desktop, VS Code and Edge WebView2 are never matched.
function allProcesses() {
  if (WIN) {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress'],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
    return [].concat(JSON.parse(out.trim() || '[]')).map((r) => ({ pid: r.ProcessId, ppid: r.ParentProcessId, name: r.Name || '', cmd: r.CommandLine || '' }));
  }
  const out = execFileSync('ps', ['-axo', 'pid=,ppid=,command='], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out.split(/\r?\n/).map((l) => l.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean)
    .map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), name: '', cmd: m[3] }));
}
const BROWSER_EXE_WIN = /^(chrome|brave|opera|msedge|firefox)\.exe$/i;
const BROWSER_PATH = /(Google Chrome|Brave Browser|Opera\.app|\/Opera|Microsoft Edge|firefox|chromium|google-chrome|brave-browser|microsoft-edge)/i;
const isBrowser = (p) => (WIN ? BROWSER_EXE_WIN.test(p.name) : BROWSER_PATH.test(p.cmd.split(' --')[0]));
async function trim(args = process.argv.slice(3)) {
  const all = args.includes('--all'), dry = args.includes('--dry');
  const procs = allProcesses().filter((p) => p.pid !== process.pid);
  const children = new Map();
  for (const p of procs) children.set(p.ppid, [...(children.get(p.ppid) || []), p.pid]);
  const keep = new Set();
  const protect = (pid) => { if (keep.has(pid)) return; keep.add(pid); for (const c of children.get(pid) || []) protect(c); };
  if (!all) for (const p of procs) if (isBrowser(p) && /--remote-debugging-port=/.test(p.cmd) && /rh-search/.test(p.cmd)) protect(p.pid);
  const victims = procs.filter((p) => !keep.has(p.pid) && isBrowser(p));
  if (!victims.length) { console.log('trim: no browser to close'); return 0; }
  let closed = 0, denied = 0;
  if (!dry) for (const v of victims) { try { process.kill(v.pid, 'SIGKILL'); closed++; } catch (e) { if (e.code !== 'ESRCH') denied++; } }
  console.log(dry ? `trim (dry): would close ${victims.length} browser processes`
    : `trim: closed ${closed} browser processes${denied ? `, ${denied} refused (access denied)` : ''}${all ? ' (search browsers too)' : ', search browsers kept'}`);
  return 0;
}

// ---- main -----------------------------------------------------------------------------------------------------------

const COMMANDS = { browsers, start, status: async () => { await status(); return 0; }, stop, trim };
const cmd = process.argv[2];
if (!COMMANDS[cmd]) {
  console.error('usage: node scripts/search-ctl.mjs browsers | start | status | stop | trim   (npm run search:browsers|start|status|stop)');
  process.exit(2);
}
try { process.exit(await COMMANDS[cmd]()); } catch (e) { console.error(e.message); process.exit(1); }
