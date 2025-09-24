#!/usr/bin/env node
// Automatically analyze all cases under logs/0.10.01 or chrome-logs, count PASS/FAIL and generate summary.md
const fs = require('fs');
const path = require('path');

// Support command line arguments logsRoot outFile
const argv = process.argv.slice(2);
function getArg(name, def) {
  const idx = argv.indexOf('--' + name);
  return idx >= 0 && argv[idx+1] ? argv[idx+1] : def;
}
const config = {
  logsRoot: path.resolve(__dirname, getArg('logsRoot', '../logs/0.10.01')),
  outFile: path.resolve(__dirname, getArg('outFile', '../logs/0.10.01/summary.md')),
  logFilePatterns: [/.out.log$/, /.err.log$/, /^console\.log$/, /\.log$/], // Support .out.log/.err.log/console.log/.log
  passPattern: /\bPASS\b/,
  failPattern: /\bFAIL\b/,
  caseDirFilter: (name) => !name.startsWith('.'),
  showDetails: false,
};

function countPassFail(file) {
  let pass = 0, fail = 0;
  if (!fs.existsSync(file)) return { pass, fail };
  const lines = fs.readFileSync(file, 'utf-8').split('\n');
  for (const line of lines) {
    if (config.passPattern.test(line)) pass++;
    if (config.failPattern.test(line)) fail++;
  }
  return { pass, fail };
}

// Count all log files under a case folder
function analyzeCaseDir(caseDir) {
  const files = fs.readdirSync(caseDir).filter(f => config.logFilePatterns.some(pat => pat.test(f)));
  let pass = 0, fail = 0;
  for (const f of files) {
    const { pass: p, fail: f1 } = countPassFail(path.join(caseDir, f));
    pass += p;
    fail += f1;
  }
  return { pass, fail };
}

// Count a single .log file
function analyzeCaseFile(logFile) {
  const { pass, fail } = countPassFail(logFile);
  return { pass, fail };
}

function walkCases(root, rel = '') {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return [];
  const stat = fs.statSync(abs);
  if (stat.isDirectory()) {
    const entries = fs.readdirSync(abs).filter(config.caseDirFilter);
  // Determine if it is a case folder (contains log files)
    const hasLog = entries.some(e => config.logFilePatterns.some(pat => pat.test(e)));
    if (hasLog && rel && config.logsRoot.indexOf('chrome-logs') === -1) {
    // jsar-runner: only count case folders
      return [{ caseName: rel, absPath: abs, isFile: false }];
    }
  // Recursively process all subdirectories
    let results = [];
    for (const entry of entries) {
      const subRel = rel ? path.join(rel, entry) : entry;
      results = results.concat(walkCases(root, subRel));
    }
    return results;
  } else if (stat.isFile() && /\.log$/.test(abs) && config.logsRoot.indexOf('chrome-logs') !== -1) {
  // chrome-runner: count all .log files, caseName is the relative path with .log removed
    return [{ caseName: rel.replace(/\.log$/, ''), absPath: abs, isFile: true }];
  }
  return [];
}

function main() {
  const caseItems = walkCases(config.logsRoot);
  let table = '| case | PASS | FAIL | 通过率 |\n|------|------|------|--------|\n'; 
  for (const item of caseItems) {
    let pass = 0, fail = 0;
    if (item.isFile) {
      ({ pass, fail } = analyzeCaseFile(item.absPath));
    } else {
      ({ pass, fail } = analyzeCaseDir(item.absPath));
    }
    const total = pass + fail;
    const rate = total ? ((pass/total)*100).toFixed(1)+'%' : '-';
    table += `| ${item.caseName} | ${pass} | ${fail} | ${rate} |\n`;
  }
  fs.writeFileSync(config.outFile, table, 'utf-8');
  console.log('Summary written to', config.outFile);
}

if (require.main === module) main();