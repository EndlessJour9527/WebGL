const fs = require('fs');
const path = require('path');
const glob = require('glob');

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function rmDirSyncSafe(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function getCaseFiles(casesRoot, caseGlob, excludeDirs) {
  const minimatch = require('minimatch');
  const globPatterns = Array.isArray(caseGlob) ? caseGlob : [caseGlob];
  const allFiles = new Set();
  for (const pattern of globPatterns) {
    for (const file of glob.sync(pattern, { cwd: casesRoot, absolute: true })) {
      allFiles.add(file);
    }
  }
  let caseFiles = Array.from(allFiles);
  if (excludeDirs && excludeDirs.length > 0) {
    caseFiles = caseFiles.filter(absPath => {
      const relPath = path.relative(casesRoot, absPath);
      return !excludeDirs.some(pattern => minimatch(relPath, pattern));
    });
  }
  return caseFiles;
}

function copyDirSync(src, dest) {
  ensureDirSync(dest);
  if (!fs.existsSync(src)) return;
  for (const entry of fs.readdirSync(src)) {
    const s = path.join(src, entry);
    const d = path.join(dest, entry);
    const stat = fs.statSync(s);
    if (stat.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

module.exports = {
  ensureDirSync,
  rmDirSyncSafe,
  getCaseFiles,
  copyDirSync, // 新增
};