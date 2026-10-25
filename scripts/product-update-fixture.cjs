// Use only against the local preview build, then restore in the same check.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const worker = path.join(root, 'dist', 'sw.js');
const saved = path.join(root, 'output', 'playwright', 'sw-update-original.js');
if (process.argv[2] === 'restore') {
  fs.writeFileSync(worker, fs.readFileSync(saved));
} else if (process.argv[2] === 'prepare') {
  fs.mkdirSync(path.dirname(saved), { recursive: true });
  fs.writeFileSync(saved, fs.readFileSync(worker));
  fs.appendFileSync(worker, '\n// local update verification ' + Date.now() + '\n');
} else { throw new Error('Choose prepare or restore'); }
