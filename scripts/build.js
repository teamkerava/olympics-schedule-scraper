#!/usr/bin/env node
// ES module wrapper for build. Use SKIP_FETCH_SCHEDULE to avoid running
// the Chrome-based fetch step in environments that don't provide the
// native libraries required by Chromium.

import { spawnSync } from 'child_process';

const skip = !!process.env.SKIP_FETCH_SCHEDULE;

if (!skip) {
  console.log('Running fetch-schedule...');
  const res = spawnSync('npm', ['run', 'fetch-schedule'], { stdio: 'inherit', shell: true });
  if (res.status !== 0) {
    console.error('fetch-schedule failed, aborting build');
    process.exit(res.status ?? 1);
  }
} else {
  console.log('SKIP_FETCH_SCHEDULE is set, skipping fetch-schedule');
}

console.log('Running astro build...');
const res2 = spawnSync('npx', ['astro', 'build'], { stdio: 'inherit', shell: true });
if (res2.status !== 0) process.exit(res2.status ?? 1);
