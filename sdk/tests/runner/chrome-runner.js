#!/usr/bin/env node
// Chrome runner: Use puppeteer to open all cases in batch, collect console logs and generate summary
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');


// Read runner.config.json to sync configuration
const configPath = path.resolve(__dirname, 'runner.config.json');
const runnerCfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const config = {
  casesRoot: path.resolve(__dirname, runnerCfg.casesRoot || '../conformance2'),
  caseGlob: runnerCfg.caseGlob || '**/*.html',
  logsOut: path.resolve(__dirname, runnerCfg.chromeLogsOut || '../logs/chrome-logs'),
  summaryFile: path.resolve(__dirname, runnerCfg.chromeSummaryFile || '../logs/chrome-logs/summary.md'),
  waitMs: (runnerCfg.execution && typeof runnerCfg.execution.waitMs === 'number') ? runnerCfg.execution.waitMs : 8000,
  passPattern: /\bPASS\b/,
  failPattern: /\bFAIL\b/,
  excludeDirs: Array.isArray(runnerCfg.excludeDirs) ? runnerCfg.excludeDirs : []
};

const glob = require('glob');

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function runCase(browser, absCasePath, caseName) {
  const url = 'file://' + absCasePath;
  const logs = [];
  const page = await browser.newPage();
  page.on('console', msg => logs.push(msg.text()));
  await page.goto(url);
  await new Promise(res => setTimeout(res, config.waitMs));
  await page.close();
  // Save logs to logsOut/<dir>/<caseName>.log
  const rel = path.relative(config.casesRoot, absCasePath);
  const relDir = path.dirname(rel);
  const baseName = path.basename(rel, '.html');
  const outDir = path.join(config.logsOut, relDir);
  ensureDirSync(outDir);
  fs.writeFileSync(path.join(outDir, baseName + '.log'), logs.join('\n'), 'utf-8');
  return logs;
}

function analyzeLogs(logs) {
  let pass = 0, fail = 0;
  for (const line of logs) {
    if (config.passPattern.test(line)) pass++;
    if (config.failPattern.test(line)) fail++;
  }
  return { pass: Math.floor(pass/2), fail: Math.floor(fail/2) };
}

async function main() {
  ensureDirSync(config.logsOut);
  let caseFiles = glob.sync(config.caseGlob, { cwd: config.casesRoot, absolute: true });
  if (config.excludeDirs.length > 0) {
    const minimatch = require('minimatch');
    caseFiles = caseFiles.filter(absPath => {
      const relPath = path.relative(config.casesRoot, absPath);
      return !config.excludeDirs.some(pattern => minimatch(relPath, pattern));
    });
  }
  console.log(`[ChromeRunner] Found ${caseFiles.length} case(s) after excludeDirs filter.`);
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  let table = '| case | PASS | FAIL | 通过率 |\n|------|------|------|--------|\n';
  for (const absCasePath of caseFiles) {
    const rel = path.relative(config.casesRoot, absCasePath);
    const caseName = rel.replace(/[\\/]/g, '__').replace(/\.html$/i, '');
    console.log(`[ChromeRunner] Running: ${rel}`);
    const logs = await runCase(browser, absCasePath, caseName);
    const { pass, fail } = analyzeLogs(logs);
    const total = pass + fail;
    const rate = total ? ((pass/total)*100).toFixed(1)+'%' : '-';
    table += `| ${caseName} | ${pass} | ${fail} | ${rate} |\n`;
  }
  await browser.close();
  fs.writeFileSync(config.summaryFile, table, 'utf-8');
  console.log('Summary written to', config.summaryFile);
}

if (require.main === module) main();
