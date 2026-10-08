// Keeps the booking-link search running across browsers without anyone watching (owner, 2026-10-05:
// "keep doing without asking me, speed up and down based on rate limits").
//
// One worker per browser (google_ota_search.mjs): Opera takes the never-searched stays (quick pass,
// all.tsv) and then turns to the deep re-check; Chrome and Edge re-check the
// 'retry' rows of unfound.tsv (deep pass: the name on its own, then one booking site at a time, each
// on up to three engines). Each worker paces itself on challenges; this supervisor:
//   - restarts a worker that crashed (after a minute) or whose engines all gave up (after 30 min),
//   - restarts a deep worker that finished its list (new 'retry' rows keep arriving), up to ROUNDS times,
//   - stops a worker whose log has not moved for 15 min, and restarts it,
//   - pauses every worker when the disk is almost full (swap lives on it),
//   - closes leftover booking-site pages (owner, 2026-10-06: used tabs stayed open in Opera and Edge):
//     a worker reads a booking page in seconds and closes it, so one still open on two sweeps 5 min
//     apart was left behind by a stopped or crashed worker. Works with --no-tidy (Opera's and Edge's two workers).
//   - writes a status line every 30 min.
// Run:  nohup node scripts/stays/search_supervisor.mjs >> scripts/stays/.cache/booking-search-2026-10-04/supervisor.log 2>&1 &
// Stop: kill the supervisor first (it leaves the workers running), then stop the workers.
import { spawn, execSync } from 'child_process';
import os from 'os';
import { statfsSync } from 'fs';
import { openSync, readFileSync, statSync, existsSync, mkdirSync, rmdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { pythonCommand, pythonEnv } from '../py.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const LOGS = `${ROOT}scripts/stays/.cache/booking-search-2026-10-04/`;
const LOCK = `${ROOT}docs/booking-links/.lists-lock`;
const COMMON = ['--engines', 'google,bing,brave,ddg', '--gap', '5-10', '--limit', '4000'];
const ROUNDS = 4;
// Three browsers at a time: with four or five open the Mac ran out of memory (owner's laptop: 18 GB swap,
// 4 GB disk free). Brave and Firefox are left out; the others take their shares when they finish.
// owner, 2026-10-05: the never-searched list (all.tsv) first, split three ways, then the re-checks
const WORKERS = [
  // Opera is the steadiest browser (1,028 stays, no blocked spells): two sessions share it, each closing only its own tabs
  // 2026-10-07, Windows laptop (15.8 GB, 0.4 GB free with five workers): every engine rested or blocked and tabs did not answer, so three
  // workers (Opera, Edge, Brave; Chrome is attached but idle) share the deep re-check in thirds. The 159 review rows come first on Opera:
  // they re-open pages already stored, so no search engine is asked.
  // 2026-10-08 (Mac, owner: "finish unfound asap, more agents and browsers"): five workers share the deep re-check in fifths:
  // Opera, Brave, Edge (two sessions: it is the least blocked) and the spare Chrome. The review rows were settled first on Opera.
  { name: 'opera', how: ['--attach', 'opera=http://localhost:9223'], plan: [['deep', '1/5', '--no-tidy']] },
  { name: 'brave', how: ['--attach', 'brave=http://localhost:9224'], plan: [['deep', '2/5', '--no-tidy']] },
  // Edge is the least blocked browser (owner, 2026-10-06, from the logs: Bing never challenged it, 2 stalls in 707 stays,
  // against Opera's 27 in 1,191). Two sessions share it, so each closes only its own tabs.
  { name: 'edge', how: ['--attach', 'edge=http://localhost:9225'], plan: [['deep', '3/5', '--no-tidy']] },
  { name: 'edge2', how: ['--attach', 'edge=http://localhost:9225'], plan: [['deep', '4/5', '--no-tidy']] },
  { name: 'chrome', how: ['--attach', 'chrome=http://localhost:9222'], plan: [['deep', '5/5', '--no-tidy']] },
].map((w) => ({ ...w, step: 0, rounds: 0, pid: 0, notBefore: 0, diskWait: 0, crashes: [], finished: false, logOffset: 0 }));


// Works on macOS and Windows (owner, 2026-10-06: the search moves to a Windows laptop; docs/booking-links/RULES.md §5).
const WIN = process.platform === 'win32';
const sleepMs = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const diskFreeGb = () => { try { const f = statfsSync(ROOT); return (f.bavail * f.bsize) / 1e9; } catch { return 999; } };
// the running search workers: [{ pid, cmd }]
function workerProcesses() {
  try {
    if (WIN) {
      const out = execSync('powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'node.exe\'\\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"', { encoding: 'utf8', windowsHide: true });
      const rows = [].concat(JSON.parse(out || '[]'));
      return rows.filter((r) => /google_ota_search/.test(r.CommandLine || '')).map((r) => ({ pid: r.ProcessId, cmd: r.CommandLine.replace(/^.*?(scripts[\\/]stays[\\/]google_ota_search)/, 'node $1').replace(/\\/g, '/') }));
    }
    return execSync("pgrep -fl '^node scripts/stays/google_ota_search'").toString().trim().split(/\r?\n/).map((l) => { const [pid, ...cmd] = l.split(' '); return { pid: Number(pid), cmd: cmd.join(' ') }; });
  } catch { return []; }
}

const stamp = () => new Date().toTimeString().slice(0, 8);
const say = (...a) => console.log(stamp(), ...a);
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const logFile = (w) => `${LOGS}r4-${w.name}.log`;

function start(w) {
  const [mode, shard, ...extra] = w.plan[w.step];
  const args = ['scripts/stays/google_ota_search.mjs', '--shard', shard, ...w.how, ...COMMON, ...(mode === 'deep' ? ['--deep'] : []), ...extra];
  const f = logFile(w);
  w.logOffset = existsSync(f) ? statSync(f).size : 0;
  const fd = openSync(f, 'a');
  const child = spawn('node', args, { cwd: ROOT, detached: true, windowsHide: true, stdio: ['ignore', fd, fd] });
  child.unref();
  w.pid = child.pid; w.startedAt = Date.now();
  say(`started ${w.name} (${mode} ${shard}) pid ${w.pid}`);
}

function since(w) { // this run's part of the worker's log
  // the offset is in bytes (file size), so slice the bytes, then decode (the log has ₹ and other multi-byte text)
  try { return readFileSync(logFile(w)).subarray(w.logOffset).toString('utf8'); } catch { return ''; }
}

function stop(w, why) { // under the lists lock, so a list write is never cut short
  for (let i = 0; i < 200; i++) { try { mkdirSync(LOCK); break; } catch { sleepMs(100); } }
  try { process.kill(w.pid, 'SIGTERM'); if (!WIN) sleepMs(5000); /* Windows ends it at once: no handler runs, so nothing to wait for */ if (alive(w.pid)) process.kill(w.pid, 'SIGKILL'); } catch { /* gone */ }
  try { rmdirSync(LOCK); } catch { /* not ours */ }
  say(`stopped ${w.name}: ${why}`);
}

// Disk nearly full (swap lives on it). Two floors (owner, 2026-10-08: "it should never stop unless
// done" — the old single 3 GB floor fully halted every worker and, because this check reruns every
// tick, kept re-arming its own "5 min pause" forever while disk stayed low, so it never actually
// resumed on its own): under 1.5 GB is an emergency (every worker stops, same as before); 1.5-3 GB
// is tight, not an emergency, so one worker keeps running (cuts disk/memory pressure from three or
// four browser profiles down to one, without going fully idle while disk recovers).
function diskEmergency() {
  return diskFreeGb() < 1.5;
}
function diskTight() {
  return diskFreeGb() < 3;
}

// A supervisor restarted while its workers run: take them over instead of starting twins.
function adopt(w) {
  for (const { pid, cmd: c } of workerProcesses()) {
    w.plan.forEach(([mode, shard, ...extra], i) => {
      // two sessions can share a browser: the extra flags (--reverse, --review) tell them apart
      const flagsMatch = ['--reverse', '--review'].every((f) => extra.includes(f) === c.includes(f));
      if (!w.pid && c.includes(`--shard ${shard} `) && c.includes(w.how.join(' ')) && (mode === 'deep') === c.includes('--deep') && flagsMatch
          && !WORKERS.some((o) => o !== w && o.pid === Number(pid))) { w.pid = Number(pid); w.step = i; }
    });
  }
  if (w.pid) { w.logOffset = existsSync(logFile(w)) ? statSync(logFile(w)).size : 0; say(`adopted running ${w.name} (${w.plan[w.step].join(' ')}) pid ${w.pid}`); }
}

function memoryTight() {
  try {
    const disk = diskFreeGb();
    if (WIN || process.platform === 'linux') { // free RAM under 1.5 GB (0.8 on Windows, where five browsers sit near that line all day), or the disk under 5 GB
      const freeGb = os.freemem() / 1e9;
      return freeGb < (WIN ? 0.8 : 1.5) || disk < 5 ? `free memory ${freeGb.toFixed(1)} GB, disk ${Math.round(disk)} GB free` : '';
    }
    const lvl = Number(execSync('sysctl -n kern.memorystatus_vm_pressure_level').toString());
    // macOS keeps swap high for days and adds swap files as it needs them: what matters is swap nearly full while the disk
    // it grows onto is low too
    const swapFree = Number((execSync('sysctl -n vm.swapusage').toString().match(/free = ([0-9.]+)M/) || [])[1] || 9999);
    return lvl >= 4 || (swapFree < 800 && disk < 8) || disk < 5 ? `pressure ${lvl}, swap free ${Math.round(swapFree)} MB, disk ${Math.round(disk)} GB free` : '';
  } catch { return ''; }
}

function counts() {
  const n = (f) => { try { return readFileSync(`${ROOT}docs/booking-links/${f}`, 'utf8').trim().split(/\r?\n/).length - 1; } catch { return 0; } };
  const statuses = {};
  try { for (const l of readFileSync(`${ROOT}docs/booking-links/unfound.tsv`, 'utf8').trim().split(/\r?\n/).slice(1)) { const s = l.split('\t')[5]; statuses[s] = (statuses[s] || 0) + 1; } } catch { /* mid-write */ }
  return `queue ${n('all.tsv')}, found ${n('found.tsv')}, unfound ${JSON.stringify(statuses)}, review ${n('review.tsv')}`;
}

// Same list as isBookingTab in google_ota_search.mjs: keep both in step.
const BOOKING_HOST = /(^|\.)(?:booking\.com|goibibo\.com|makemytrip\.[a-z.]+|agoda\.com|easemytrip\.com|trip\.com|trivago\.[a-z.]+|airbnb\.[a-z.]+|oyorooms\.com|hostelworld\.com|expedia\.[a-z.]+|hotels\.com|cleartrip\.com)$/;
const PORTS = [...new Set(WORKERS.flatMap((w) => w.how.filter((a) => a.includes('http://')).map((a) => a.split('=')[1])))];
let seenBooking = new Map(); // tab id -> url, from the previous sweep
let lastSweep = 0;
async function sweepLeftovers() {
  const next = new Map();
  let closed = 0;
  for (const base of PORTS) {
    let pages;
    try { pages = (await (await fetch(`${base}/json/list`, { signal: AbortSignal.timeout(8000) })).json()).filter((t) => t.type === 'page'); } catch { continue; }
    let open = pages.length;
    for (const t of pages) {
      // a booking page, or a tab doing nothing (blank, a browser start page, google.com's home page) that sat unchanged for two sweeps
      // (owner, 2026-10-07: "close tabs that are not in use"): a worker's own tab is always on a results page or on its way to one
      let host = '';
      try { host = new URL(t.url).hostname; } catch { /* about:blank and the like */ }
      const idleTab = /^(?:about:blank|(?:chrome|edge|opera|brave):\/\/(?:newtab|new-tab-page|startpage|welcome|easy-setup)\/?)$/.test(t.url)
        || (/^www\.google\.[a-z.]+$/.test(host) && new URL(t.url).pathname === '/' && !new URL(t.url).search);
      if (!BOOKING_HOST.test(host) && !idleTab) continue;
      if (seenBooking.get(t.id) === t.url && open > 1) { // never the browser's last tab
        await fetch(`${base}/json/close/${t.id}`, { signal: AbortSignal.timeout(8000) }).catch(() => {});
        closed++; open--;
      } else next.set(t.id, t.url);
    }
  }
  seenBooking = next;
  if (closed) say(`closed ${closed} leftover booking or idle page(s)`);
}

say('supervisor up:', counts());
for (const w of WORKERS) adopt(w);
let lastStatus = 0, held = 0, lastTrim = 0;
for (;;) {
  const now = Date.now();
  const tight = memoryTight();
  // memory rule (owner, 2026-10-07: "I don't need any browser for myself"): when memory is tight, every browser that is not a
  // search browser is closed, at most every 10 minutes (node scripts/search-ctl.mjs trim; RULES.md section 5)
  if (tight && now - lastTrim > 10 * 60e3) {
    lastTrim = now;
    try { say('memory rule:', execSync('node scripts/search-ctl.mjs trim', { cwd: ROOT, encoding: 'utf8', timeout: 120000, windowsHide: true }).trim()); } catch (e) { say('memory rule: trim failed:', String(e.message).split(/\r?\n/)[0]); }
  }
  if (diskEmergency()) {
    for (const w of WORKERS) if (w.pid && alive(w.pid)) { stop(w, 'disk almost full (under 1.5 GB): paused 2 min'); w.notBefore = now + 2 * 60e3; w.pid = 0; }
    await new Promise((r) => setTimeout(r, 60e3));
    continue;
  }
  const diskLow = diskTight(); // 1.5-3 GB: degrade to one worker, keep going, never go fully idle
  for (const w of WORKERS) {
    if (w.finished) continue;
    if (w.pid && alive(w.pid)) {
      // stalled: no log line for 15 minutes
      try { if (now - statSync(logFile(w)).mtimeMs > 15 * 60e3) { stop(w, 'log silent for 15 min'); w.notBefore = now + 60e3; } } catch { /* no log yet */ }
      // owner, 2026-10-05: a short pause, 5 to 10 min at random, not 30
      if (w.heavy && tight) { const mins = 5 + Math.round(Math.random() * 5); stop(w, `memory tight (${tight}), paused ${mins} min`); held = now + mins * 60e3; w.notBefore = held; }
      // disk tight, not an emergency: let this one keep running (the next check below stops it
      // being replaced once it ends, and blocks any other worker from starting) rather than killing
      // work in progress
      continue;
    }
    if (now < w.notBefore || (w.heavy && (tight || now < held))) continue;
    if (diskLow && WORKERS.some((o) => o !== w && o.pid && alive(o.pid))) {
      if (!w.diskWait || now - w.diskWait > 10 * 60e3) { w.diskWait = now; say(`${w.name}: disk under 3 GB, one worker already running; waiting`); }
      continue;
    }
    if (w.pid) { // it ended: why?
      const log = since(w);
      const done = log.match(/ done (\{.*\})\s*$/m);
      if (!done) {
        w.crashes = [...w.crashes.filter((t) => now - t < 3600e3), now];
        w.notBefore = now + (w.crashes.length > 5 ? 30 * 60e3 : 60e3);
        say(`${w.name} ended without finishing (${w.crashes.length} in the last hour): restart ${w.crashes.length > 5 ? 'in 30 min' : 'in 1 min'}`);
        w.pid = 0; continue;
      }
      const t = JSON.parse(done[1]);
      const worked = Object.values(t).reduce((a, b) => a + b, 0) - (t.unresolved || 0) - (t.skipped || 0);
      say(`${w.name} done: ${done[1]}`);
      w.pid = 0;
      if (t.unresolved && t.unresolved >= worked) { w.notBefore = now + 10 * 60e3; say(`${w.name}: its engines were all resting or blocked; again in 10 min`); continue; }
      const [mode] = w.plan[w.step];
      if (mode === 'quick' || worked === 0 || ++w.rounds >= ROUNDS) {
        if (w.step + 1 < w.plan.length) { w.step++; w.rounds = 0; say(`${w.name}: on to ${w.plan[w.step].join(' ')}`); }
        else { w.finished = true; say(`${w.name}: finished`); continue; }
      }
    }
    start(w);
  }
  if (now - lastSweep >= 5 * 60e3) { lastSweep = now; await sweepLeftovers(); }
  if (WORKERS.every((w) => w.finished)) { say('all workers finished:', counts()); break; }
  if (now - lastStatus > 30 * 60e3) {
    lastStatus = now;
    // stays that are already listed (a duplicate with its page, or a linked twin 40 m away) leave unfound.tsv: record them in found.tsv
    // the pages the searches harvested (up to 6 per search): opened in parallel within seconds, then mapped across to our stays,
    // and the stays that are already listed leave unfound.tsv (docs/booking-links/RULES.md)
    // Python is looked up inside tail's try (cmd may be a function), so a missing Python fails only these two steps, not the supervisor
    const py = (script) => () => `${pythonCommand().map((x) => (/\s/.test(x) ? `"${x}"` : x)).join(' ')} ${script}`;
    const tail = (cmd, n, ms) => { try { return execSync(`${typeof cmd === 'function' ? cmd() : cmd} 2>&1`, { cwd: ROOT, timeout: ms, encoding: 'utf8', env: pythonEnv, windowsHide: true }).trim().split(/\r?\n/).slice(-n).join(' | '); } catch (e) { return `failed: ${String(e.message).split('\n')[0]}`; } };
    say('seen pages:', tail('node scripts/stays/verify_seen.mjs --limit 400 --refresh-days 10', 1, 360000), '|', tail(py('scripts/stays/map_seen_pages.py'), 2, 120000));
    say('prune_unfound:', tail(py('scripts/stays/prune_unfound.py'), 3, 120000));
    // what merge_found.sh would auto-list from new-properties.tsv: a dry run, it writes nothing (the merge is serialised and owner-run)
    say('new stays:', tail(py('scripts/stays/import_new_stays.py --dry'), 2, 120000));
    say('status:', counts(), '|', WORKERS.map((w) => `${w.name} ${w.finished ? 'finished' : w.pid && alive(w.pid) ? `${w.plan[w.step].join(' ')}` : 'waiting'}`).join(', '), tight ? `| memory: ${tight}` : '');
  }
  await new Promise((r) => setTimeout(r, 60e3));
}
