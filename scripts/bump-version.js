/**
 * Run this before every git push to bump the SW version.
 * This triggers the "Update Available" banner on all devices.
 *
 * Usage:  node scripts/bump-version.js
 */
const fs   = require('fs');
const path = require('path');

const swPath = path.join(__dirname, '../public/service-worker.js');
let sw = fs.readFileSync(swPath, 'utf8');

// Extract current version
const match = sw.match(/const CACHE_VERSION = 'foodbridge-v([\d.]+)'/);
if (!match) { console.error('❌ Could not find CACHE_VERSION in service-worker.js'); process.exit(1); }

// Bump patch version: 1.0.0 → 1.0.1
const parts = match[1].split('.').map(Number);
parts[2]++;
const newVersion = parts.join('.');

sw = sw.replace(
  `const CACHE_VERSION = 'foodbridge-v${match[1]}'`,
  `const CACHE_VERSION = 'foodbridge-v${newVersion}'`
);

fs.writeFileSync(swPath, sw);
console.log(`✅ Version bumped: v${match[1]} → v${newVersion}`);
console.log('   All installed devices will see "Update Available" on next visit.');
