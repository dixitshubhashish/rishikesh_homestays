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
//   - writes a status line every 30 min.
// Run:  nohup node scripts/stays/search_supervisor.mjs >> scripts/stays/.cache/booking-search-2026-10-04/supervisor.log 2>&1 &
// Stop: kill the supervisor first (it leaves the workers running), then stop the workers.
import { spawn, execSync } from 'child_process';
import { openSync, readFileSync, statSync, existsSync, mkdirSync, rmdirSync } from 'fs';

const ROOT = new URL('../../', import.meta.url).pathname;
const LOGS = `${ROOT}scripts/stays/.cache/booking-search-2026-10-04/`;
const LOCK = `${ROOT}docs/booking-links/.lists-lock`;
const COMMON = ['--engines', 'google,bing,brave,ddg', '--gap', '5-10', '--limit', '4000'];
const ROUNDS = 4;
// Three browsers at a time: with four or five open the Mac ran out of memory (owner's laptop: 18 GB swap,
// 4 GB disk free). Brave and Firefox are left out; the others take their shares when they finish.
// owner, 2026-10-05: the never-searched list (all.tsv) first, split three ways, then the re-checks
const WORKERS = [
  // Opera is the steadiest browser (1,028 stays, no blocked spells): two sessions share it, each closing only its own tabs
  { name: 'opera', how: ['--attach', 'opera=http://localhost:9223'], plan: [['quick', '1/3', '--no-tidy'], ['quick', '1/1', '--reverse', '--no-tidy'], ['deep', '5/5', '--no-tidy']] },
  { name: 'opera2', heavy: true, how: ['--attach', 'opera=http://localhost:9223'], plan: [['quick', '1/1', '--review', '--no-tidy'], ['deep', '4/5', '--no-tidy']] },
  { name: 'chrome', how: ['--attach', 'chrome=http://localhost:9222'], plan: [['quick', '2/3'], ['deep', '1/5']] },
  // Brave is open anyway and was idle (owner, 2026-10-05: up to 10 agents); disk is guarded by the pause below
  { name: 'brave', how: ['--attach', 'brave=http://localhost:9224'], plan: [['deep', '2/5']] },
  // a fourth worker (Brave) pushed the disk under 3 GB twice (2026-10-05): three workers is this Mac's limit

  { name: 'edge', how: ['--attach', 'edge=http://localhost:9225'], plan: [['quick', '3/3'], ['deep', '3/5']] },
].map((w) => ({ ...w, step: 0, rounds: 0, pid: 0, notBefore: 0, crashes: [], finished: false, logOffset: 0 }));

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
  const child = spawn('node', args, { cwd: ROOT, detached: true, stdio: ['ignore', fd, fd] });
  child.unref();
  w.pid = child.pid; w.startedAt = Date.now();
  say(`started ${w.name} (${mode} ${shard}) pid ${w.pid}`);
}

function since(w) { // this run's part of the worker's log
  // the offset is in bytes (file size), so slice the bytes, then decode (the log has ₹ and other multi-byte text)
  try { return readFileSync(logFile(w)).subarray(w.logOffset).toString('utf8'); } catch { return ''; }
}

function stop(w, why) { // under the lists lock, so a list write is never cut short
  for (let i = 0; i < 200; i++) { try { mkdirSync(LOCK); break; } catch { execSync('sleep 0.1'); } }
  try { process.kill(w.pid, 'SIGTERM'); execSync('sleep 5'); if (alive(w.pid)) process.kill(w.pid, 'SIGKILL'); } catch { /* gone */ }
  try { rmdirSync(LOCK); } catch { /* not ours */ }
  say(`stopped ${w.name}: ${why}`);
}

// Disk nearly full (swap lives on it): every worker stops until there is room again.
function diskCritical() {
  try { return Number(execSync("df -g / | awk 'NR==2 {print $4}'").toString()) < 3; } catch { return false; }
}

// A supervisor restarted while its workers run: take them over instead of starting twins.
function adopt(w) {
  try {
    const lines = execSync("pgrep -fl '^node scripts/stays/google_ota_search'").toString().trim().split('\n');
    for (const l of lines) {
      const [pid, ...cmd] = l.split(' ');
      const c = cmd.join(' ');
      w.plan.forEach(([mode, shard, ...extra], i) => {
        // two sessions can share a browser: the extra flags (--reverse, --review) tell them apart
        const flagsMatch = ['--reverse', '--review'].every((f) => extra.includes(f) === c.includes(f));
        if (!w.pid && c.includes(`--shard ${shard} `) && c.includes(w.how.join(' ')) && (mode === 'deep') === c.includes('--deep') && flagsMatch
            && !WORKERS.some((o) => o !== w && o.pid === Number(pid))) { w.pid = Number(pid); w.step = i; }
      });
    }
  } catch { /* none running */ }
  if (w.pid) { w.logOffset = existsSync(logFile(w)) ? statSync(logFile(w)).size : 0; say(`adopted running ${w.name} (${w.plan[w.step].join(' ')}) pid ${w.pid}`); }
}

function memoryTight() {
  try {
    const lvl = Number(execSync('sysctl -n kern.memorystatus_vm_pressure_level').toString());
    // macOS keeps swap high for days and adds swap files as it needs them: what matters is swap nearly full while the disk
    // it grows onto is low too
    const swapFree = Number((execSync('sysctl -n vm.swapusage').toString().match(/free = ([0-9.]+)M/) || [])[1] || 9999);
    const disk = Number(execSync("df -g / | awk 'NR==2 {print $4}'").toString());
    return lvl >= 4 || (swapFree < 800 && disk < 8) || disk < 5 ? `pressure ${lvl}, swap free ${Math.round(swapFree)} MB, disk ${disk} GB free` : '';
  } catch { return ''; }
}

function counts() {
  const n = (f) => { try { return readFileSync(`${ROOT}docs/booking-links/${f}`, 'utf8').trim().split('\n').length - 1; } catch { return 0; } };
  const statuses = {};
  try { for (const l of readFileSync(`${ROOT}docs/booking-links/unfound.tsv`, 'utf8').trim().split('\n').slice(1)) { const s = l.split('\t')[5]; statuses[s] = (statuses[s] || 0) + 1; } } catch { /* mid-write */ }
  return `queue ${n('all.tsv')}, found ${n('found.tsv')}, unfound ${JSON.stringify(statuses)}, review ${n('review.tsv')}`;
}

say('supervisor up:', counts());
for (const w of WORKERS) adopt(w);
let lastStatus = 0, held = 0;
for (;;) {
  const now = Date.now();
  const tight = memoryTight();
  if (diskCritical()) {
    for (const w of WORKERS) if (w.pid && alive(w.pid)) { stop(w, 'disk almost full (under 3 GB): paused 5 min'); w.notBefore = now + 5 * 60e3; w.pid = 0; }
    await new Promise((r) => setTimeout(r, 60e3));
    continue;
  }
  for (const w of WORKERS) {
    if (w.finished) continue;
    if (w.pid && alive(w.pid)) {
      // stalled: no log line for 15 minutes
      try { if (now - statSync(logFile(w)).mtimeMs > 15 * 60e3) { stop(w, 'log silent for 15 min'); w.notBefore = now + 60e3; } } catch { /* no log yet */ }
      // owner, 2026-10-05: a short pause, 5 to 10 min at random, not 30
      if (w.heavy && tight) { const mins = 5 + Math.round(Math.random() * 5); stop(w, `memory tight (${tight}), paused ${mins} min`); held = now + mins * 60e3; w.notBefore = held; }
      continue;
    }
    if (now < w.notBefore || (w.heavy && (tight || now < held))) continue;
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
  if (WORKERS.every((w) => w.finished)) { say('all workers finished:', counts()); break; }
  if (now - lastStatus > 30 * 60e3) {
    lastStatus = now;
    say('status:', counts(), '|', WORKERS.map((w) => `${w.name} ${w.finished ? 'finished' : w.pid && alive(w.pid) ? `${w.plan[w.step].join(' ')}` : 'waiting'}`).join(', '), tight ? `| memory: ${tight}` : '');
  }
  await new Promise((r) => setTimeout(r, 60e3));
}
