#!/usr/bin/env node
/**
 * Regression test for scripts/check-env.js — verifies the guard blocks bad
 * configs in strict (Vercel/CI) mode and only warns in lenient (local) mode.
 *
 * Run: node scripts/test-env-guard.js   (or: npm run test:env-guard)
 */
// Plain Node.js script (runs via `node`, not bundled) — CommonJS require is correct here.
/* eslint-disable @typescript-eslint/no-require-imports */
const { spawnSync } = require('child_process');
const path = require('path');

const guard = path.resolve(__dirname, 'check-env.js');
const cases = [
  {
    name: 'strict, URL missing        → should BLOCK (exit 1)',
    env: { NEXT_PUBLIC_API_URL: '', VERCEL: '1' },
    expectExit: 1,
  },
  {
    name: 'strict, localhost          → should BLOCK (exit 1)',
    env: { NEXT_PUBLIC_API_URL: 'http://localhost:3001', VERCEL: '1' },
    expectExit: 1,
  },
  {
    name: 'strict, malformed URL      → should BLOCK (exit 1)',
    env: { NEXT_PUBLIC_API_URL: 'not-a-url', VERCEL: '1' },
    expectExit: 1,
  },
  {
    name: 'strict, http:// (mixed ctn) → should BLOCK (exit 1)',
    env: { NEXT_PUBLIC_API_URL: 'http://aba-therapy-backend-7l47.onrender.com', VERCEL: '1' },
    expectExit: 1,
  },
  {
    name: 'strict, trailing slash     → should PASS (exit 0, warns)',
    env: { NEXT_PUBLIC_API_URL: 'https://aba-therapy-backend-7l47.onrender.com/', VERCEL: '1' },
    expectExit: 0,
  },
  {
    name: 'strict, valid prod URL     → should PASS (exit 0)',
    env: { NEXT_PUBLIC_API_URL: 'https://aba-therapy-backend-7l47.onrender.com', VERCEL: '1' },
    expectExit: 0,
  },
  {
    name: 'lenient, URL missing       → should PASS (exit 0, warns)',
    env: { NEXT_PUBLIC_API_URL: '' },
    expectExit: 0,
  },
  {
    name: 'lenient, localhost         → should PASS (exit 0, warns)',
    env: { NEXT_PUBLIC_API_URL: 'http://localhost:3001' },
    expectExit: 0,
  },
];

let failed = 0;
for (const c of cases) {
  const r = spawnSync(process.execPath, [guard], {
    env: { ...process.env, ...c.env },
    encoding: 'utf8',
  });
  const ok = r.status === c.expectExit;
  if (!ok) failed += 1;
  console.log(`${ok ? '✅' : '❌'} ${c.name}  (got exit ${r.status}, expected ${c.expectExit})`);
  // Show the decisive line from output for failures
  if (!ok) {
    const lines = (r.stdout + r.stderr).trim().split('\n');
    console.log('   └ ' + lines.slice(-2).join(' | '));
  }
}

console.log(failed === 0 ? '\nAll guard tests passed.' : `\n${failed} guard test(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
