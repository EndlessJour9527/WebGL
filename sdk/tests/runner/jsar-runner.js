#!/usr/bin/env node

// Runner for JSAR WebGL conformance cases.
// - Discovers HTML cases under a root folder
// - Executes each via a configurable command
// - Waits, then copies logs from jsar-runtime/.cache/logs to a versioned folder per-case

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { exec, spawn } = require('child_process');
const glob = require('glob');
const utils = require('./runner-utils');

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function ensureDirSync(dir) { utils.ensureDirSync(dir); }
function rmDirSyncSafe(dir) { utils.rmDirSyncSafe(dir); }

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  const argv = process.argv.slice(2);
  const configArgIdx = argv.indexOf('--config');
  const configPath = configArgIdx >= 0 ? argv[configArgIdx + 1] : path.join(__dirname, 'runner.config.json');
  const cfg = readJSON(configPath);

  const casesRoot = path.resolve(__dirname, cfg.casesRoot);
  const logsSrc = path.resolve(__dirname, cfg.logsSrc);
  const logsOut = path.resolve(__dirname, cfg.logsOut);
  const caseGlob = cfg.caseGlob || '**/*.html';
  const jsarBin = cfg.jsarBin ? path.resolve(cfg.jsarBin) : null;
  const useFileURL = !!cfg.useFileURL;
  if (jsarBin && !fs.existsSync(jsarBin)) {
    console.warn(`[Runner] Warning: jsarBin not found at path: ${jsarBin}`);
  }
  const jsarCwd = cfg.jsarCwd ? path.resolve(__dirname, cfg.jsarCwd) : (jsarBin ? path.dirname(jsarBin) : process.cwd());
  const inheritIO = !!cfg.inheritIO;
  const env = Object.assign({}, process.env, cfg.env || {});
  const detached = cfg.detached !== false; // default true
  const killProcessGroup = cfg.killProcessGroup !== false; // default true
  const killGraceMs = (typeof cfg.killGraceMs === 'number') ? cfg.killGraceMs : 500;

  // Track active children so we can clean them up on exit
  const activeChildren = new Set();

  function isAlive(pid) {
    try { process.kill(pid, 0); return true; } catch (_) { return false; }
  }

  async function killChild(child) {
    if (!child || !child.pid) return;
    const pid = child.pid;
    try {
      if (killProcessGroup) {
        // Send to the child's process group (negative PID)
        try { process.kill(-pid, 'SIGTERM'); } catch (_) {}
      } else {
        try { process.kill(pid, 'SIGTERM'); } catch (_) {}
      }
      await sleep(killGraceMs);
      if (isAlive(pid)) {
        if (killProcessGroup) {
          try { process.kill(-pid, 'SIGKILL'); } catch (_) {}
        } else {
          try { process.kill(pid, 'SIGKILL'); } catch (_) {}
        }
      }
    } catch (_) { /* ignore */ }
  }

  let cleaningUp = false;
  async function cleanupAndExit(code = 0) {
    if (cleaningUp) return; // prevent reentry
    cleaningUp = true;
    const children = Array.from(activeChildren);
    for (const ch of children) {
      await killChild(ch);
      activeChildren.delete(ch);
    }
    process.exit(code);
  }

  // Handle termination signals to avoid orphaned children
  process.on('SIGINT', () => cleanupAndExit(130));
  process.on('SIGTERM', () => cleanupAndExit(143));
  process.on('SIGQUIT', () => cleanupAndExit(131));
  process.on('uncaughtException', (err) => {
    console.error('[Runner] Uncaught exception:', err);
    cleanupAndExit(1);
  });

  ensureDirSync(logsOut);

  // Support excludeDirs: filter out cases matching glob patterns (relative to casesRoot)
  const excludeDirs = Array.isArray(cfg.excludeDirs) ? cfg.excludeDirs : [];
  const caseFiles = utils.getCaseFiles(casesRoot, caseGlob, excludeDirs);
  console.log(`[Runner] Found ${caseFiles.length} case(s) after excludeDirs filter.`);

  for (const absCasePath of caseFiles) {
    const rel = path.relative(casesRoot, absCasePath);
    // Split rel into dir and file name (without .html)
    const relDir = path.dirname(rel);
    const baseName = path.basename(rel, '.html');
    const outDir = path.join(logsOut, relDir, baseName);

    console.log(`\n[Runner] Running case: ${rel}`);

    // Optional: clear logs source before run for a clean snapshot
    rmDirSyncSafe(logsSrc);
    ensureDirSync(logsSrc);

    // Determine how to launch the case
    const caseArg = useFileURL ? ('file://' + absCasePath) : absCasePath;
    let child;
    if (jsarBin && (!cfg.execution || !cfg.execution.command)) {
      // Preferred: spawn JSAR directly with arguments
      const args = Array.isArray(cfg.args) && cfg.args.length ? cfg.args.slice() : ['{{absCasePath}}'];
      const resolvedArgs = args.map(a => a.replace('{{absCasePath}}', caseArg));
      console.log(`[Runner] Spawn: ${jsarBin} ${resolvedArgs.join(' ')} (cwd=${jsarCwd})`);
      child = spawn(jsarBin, resolvedArgs, { cwd: jsarCwd, stdio: inheritIO ? 'inherit' : 'ignore', env, detached });
    } else {
      // Fallback: use command template if provided
      const commandTmpl = (cfg.execution && cfg.execution.command) ? cfg.execution.command : '{{jsarBin}} {{absCasePath}}';
      const cmd = commandTmpl
        .replace('{{jsarBin}}', jsarBin || '')
        .replace('{{absCasePath}}', caseArg);
      console.log(`[Runner] Exec: ${cmd} (cwd=${jsarCwd})`);
      child = exec(cmd, { cwd: jsarCwd, env, detached });
    }
    if (child) activeChildren.add(child);

    const waitMs = (cfg.execution && typeof cfg.execution.waitMs === 'number') ? cfg.execution.waitMs : 8000;
    await sleep(waitMs);

    rmDirSyncSafe(outDir);
    ensureDirSync(outDir);
    utils.copyDirSync(logsSrc, outDir);

    try {
      if (child) {
        await killChild(child);
        activeChildren.delete(child);
      }
    } catch (_) {}
    console.log(`[Runner] Logs copied to: ${outDir}`);
  }

  console.log('\n[Runner] All done.');
}

main().catch((e) => {
  console.error('[Runner] Error:', e);
  process.exit(1);
});
