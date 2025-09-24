#!/usr/bin/env node
// workflow.js: Run jsar/chrome runner and output comparison summary with one command
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const jsarSummary = path.resolve(root, '../logs/0.10.01/summary.md');
const chromeSummary = path.resolve(root, '../logs/chrome-logs/summary.md');
const outSummary = path.resolve(root, '../logs/summary-compare.md');


function runScript(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [script, ...args], { cwd: root, stdio: 'inherit' });
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${script} ${args.join(' ')} failed`)));
  });
}


// Run both runners concurrently
async function runBothRunners() {
  return Promise.all([
    runScript('jsar-runner.js'),
    runScript('chrome-runner.js')
  ]);
}

// Run both summary scripts concurrently
async function runBothSummaries() {
  return Promise.all([
    runScript('summary.js'),
    runScript('summary.js', ['--logsRoot', '../logs/chrome-logs', '--outFile', '../logs/chrome-logs/summary.md'])
  ]);
}

function parseJsarSummaryByFolder(mdPath) {
  if (!fs.existsSync(mdPath)) return {};
  const lines = fs.readFileSync(mdPath, 'utf-8').split('\n').filter(l => l && !l.startsWith('|--'));
  const map = {};
  for (const line of lines) {
    const m = /^\|\s*([^|]+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/.exec(line);
    if (m) {
      const caseName = m[1].trim();
      map[caseName] = { pass: +m[2], fail: +m[3] };
    }
  }
  return map;
}

function parseChromeSummaryByFile(mdPath) {
  if (!fs.existsSync(mdPath)) return {};
  const lines = fs.readFileSync(mdPath, 'utf-8').split('\n').filter(l => l && !l.startsWith('|--'));
  const map = {};
  for (const line of lines) {
    const m = /^\|\s*([^|]+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/.exec(line);
    if (m) {
  const caseName = m[1].trim(); // No processing needed
      map[caseName] = { pass: +m[2], fail: +m[3] };
    }
  }
  return map;
}

function diffSummary(jsar, chrome) {
  // Directly compare using the case field
  const allCases = Array.from(new Set([...Object.keys(jsar), ...Object.keys(chrome)])).sort();
  let table = '| case | JSAR PASS | JSAR FAIL | Chrome PASS | Chrome FAIL |\n|------|-----------|-----------|-------------|-------------|\n';
  let matchCount = 0, mismatchCount = 0, missingCount = 0;
  for (const c of allCases) {
    const j = jsar[c] || { pass: '-', fail: '-' };
    const ch = chrome[c] || { pass: '-', fail: '-' };
    if (j.pass === ch.pass && j.fail === ch.fail && j.pass !== '-' && ch.pass !== '-') {
      matchCount++;
    } else if (j.pass === '-' || ch.pass === '-') {
      missingCount++;
    } else {
      mismatchCount++;
    }
    table += `| ${c} | ${j.pass} | ${j.fail} | ${ch.pass} | ${ch.fail} |\n`;
  }
  table += `| **Summary** | Matches: ${matchCount} | Mismatches: ${mismatchCount} | Missing: ${missingCount} |  |\n`;
  return table;
}


function rmDirSyncSafe(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

async function main() {
  const workflowStart = Date.now();
  // Clear all contents under the ../logs directory
  const logsDir = path.resolve(__dirname, '../logs');
  if (fs.existsSync(logsDir)) {
    for (const entry of fs.readdirSync(logsDir)) {
      const full = path.join(logsDir, entry);
      rmDirSyncSafe(full);
    }
    console.log('All contents under logs directory have been cleared');
  }
  console.log('Running jsar-runner.js and chrome-runner.js concurrently ...');
  await runBothRunners();
  // concurrent jsar/chrome summary
  console.log('Generating jsar/chrome summary concurrently ...');
  await runBothSummaries();
  // read summary
  const jsar = parseJsarSummaryByFolder(jsarSummary);
  const chrome = parseChromeSummaryByFile(chromeSummary);
  const table = diffSummary(jsar, chrome);
  fs.writeFileSync(outSummary, table, 'utf-8');

  // Workflow and per-case timing aggregation
  const workflowEnd = Date.now();
  const workflowDuration = workflowEnd - workflowStart;
  let jsarTiming = {};
  let chromeTiming = {};
  try {
    jsarTiming = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../logs/0.10.01/timing.json')));
  } catch {}
  try {
    chromeTiming = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../logs/chrome-logs/timing.json')));
  } catch {}
  const timingSummary = {
    workflowStart,
    workflowEnd,
    workflowDurationMs: workflowDuration,
    jsar: jsarTiming,
    chrome: chromeTiming
  };
  fs.writeFileSync(path.resolve(__dirname, '../logs/workflow-timing.json'), JSON.stringify(timingSummary, null, 2), 'utf-8');
  console.log('Workflow timing written to', path.resolve(__dirname, '../logs/workflow-timing.json'));
  console.log('Comparison summary has been written to', outSummary);
}

if (require.main === module) main();
