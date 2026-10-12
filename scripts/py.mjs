#!/usr/bin/env node
// Runs a Python script with the interpreter this machine has, the same way on macOS, Linux and Windows.
//   node scripts/py.mjs scripts/stays/build_pages.py --city haridwar
// The stays pipeline requires Python 3.12+ (also pinned by the GitHub refresh workflow).
// Windows uses `python` and the `py -3` launcher; its `python3` may be a Microsoft Store stub.
// There is no override: candidates come from the OS and PATH, and only a compatible interpreter is selected.
// It also forces UTF-8 for Python's file and console I/O: Windows Python 3.12 defaults to cp1252, which garbles or crashes on
// the Hindi and other non-ASCII text in the stays data (macOS already defaults to UTF-8, so nothing changes there).
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WIN = process.platform === 'win32';
const UTF8 = { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' };

function candidates() {
  return WIN ? [['python'], ['py', '-3'], ['python3']] : [['python3.12'], ['python3'], ['python']];
}

// The first candidate that is Python 3.12+ (the Windows Store stub and older Python installs are skipped).
export function pythonCommand() {
  for (const c of candidates()) {
    const r = spawnSync(c[0], [...c.slice(1), '-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 12) else 1)'], { env: UTF8, stdio: 'ignore', windowsHide: true });
    if (r.status === 0) return c;
  }
  throw new Error(`Python 3.12+ not found (tried ${candidates().map((c) => c.join(' ')).join(', ')}). ${WIN ? 'Install it with: winget install Python.Python.3.12' : 'Install Python 3.12 or newer.'}`);
}

// Environment for a Python child process started from other code (execFileSync etc.).
export const pythonEnv = UTF8;

// compare real paths: node resolves import.meta.url through symlinks but leaves argv[1] as typed, and a mismatch would exit 0 silently
const real = (f) => { try { return realpathSync(f); } catch { return f; } };
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) {
  let cmd;
  try { cmd = pythonCommand(); } catch (e) { console.error(e.message); process.exit(127); }
  const r = spawnSync(cmd[0], [...cmd.slice(1), ...process.argv.slice(2)], { env: UTF8, stdio: 'inherit', windowsHide: true });
  process.exit(r.status ?? 1);
}
