#!/usr/bin/env node
// Wrapper for the `build` script which conditionally runs the
// fetch-schedule step. This avoids launching headless Chrome in
// environments (like some CI providers / Pages) that lack necessary
// system libraries.

const { spawnSync } = require('child_process');

const skip = !!process.env.SKIP_FETCH_SCHEDULE;

if (!skip) {
  console.log('Running fetch-schedule...');
  const res = spawnSync('npm', ['run', 'fetch-schedule'], { stdio: 'inherit', shell: true });
  if (res.status !== 0) {
    console.error('fetch-schedule failed, aborting build');
    process.exit(res.status || 1);
  }
} else {
  console.log('SKIP_FETCH_SCHEDULE is set, skipping fetch-schedule');
}

console.log('Running astro build...');
const res2 = spawnSync('npx', ['astro', 'build'], { stdio: 'inherit', shell: true });
if (res2.status !== 0) process.exit(res2.status || 1);
