#!/usr/bin/env node
/**
 * Guard: validates NEXT_PUBLIC_API_URL before a production build so we never
 * ship a bundle that points at the wrong backend.
 *
 * Why this exists:
 *   1. `src/lib/api.ts` silently falls back to `http://localhost:3001` when
 *      NEXT_PUBLIC_API_URL is missing — a misconfigured production build ships
 *      with NO error and every API call fails in production.
 *   2. The Aug 1 deploy shipped with a typo (`...7147.onrender.com` instead of
 *      `...7l47.onrender.com`), which broke the live login and was hard to spot
 *      because the URL is baked into the bundle at build time.
 *
 * This guard fails fast with a clear message instead of shipping a broken app.
 *
 * Modes:
 *   - STRICT (Vercel/CI builds, or --strict): blocks the build if the URL is
 *     missing, malformed, or points at localhost. Vercel sets VERCEL=1 and CI=1
 *     automatically during builds, so production deploys get full protection.
 *   - LENIENT (local `npm run build`): same checks but warn-only — a local test
 *     build targeting localhost or using the fallback isn't blocked.
 */
// Plain Node.js script (runs via `node`, not bundled) — CommonJS require is correct here.
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
// Vercel sets VERCEL=1; most CI systems (GitHub Actions, etc.) set CI=true (or 1).
const ci = /^(1|true)$/i.test(String(process.env.CI));
const strict = args.includes('--strict') || process.env.VERCEL === '1' || ci;

// --- Dependency-free .env parser (Next.js precedence: later files win, process.env wins all) ---
function parseEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  const text = fs.readFileSync(file, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const envDir = path.resolve(__dirname, '..');
const fileEnv = ['.env', '.env.production', '.env.local', '.env.production.local']
  .map((f) => path.join(envDir, f))
  .reduce((acc, f) => Object.assign(acc, parseEnvFile(f)), {});

// Real env vars (Vercel dashboard, CI) take precedence over .env files.
const url = (process.env.NEXT_PUBLIC_API_URL || fileEnv.NEXT_PUBLIC_API_URL || '').trim();

const errors = [];
const warnings = [];

function report(level, msg) {
  (level === 'error' ? errors : warnings).push(msg);
}

if (!url) {
  const msg =
    'NEXT_PUBLIC_API_URL is not set. The built bundle would fall back to ' +
    'http://localhost:3001 and every API call would fail in production.';
  report(strict ? 'error' : 'warn', msg);
} else {
  let parsed = null;
  try {
    parsed = new URL(url);
  } catch {
    report(
      strict ? 'error' : 'warn',
      `NEXT_PUBLIC_API_URL is not a valid URL: "${url}"`
    );
  }

  if (parsed) {
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      report(
        strict ? 'error' : 'warn',
        `NEXT_PUBLIC_API_URL must be http(s):// — got "${url}"`
      );
    }
    if (strict && parsed.protocol === 'http:') {
      report(
        'error',
        `NEXT_PUBLIC_API_URL uses http:// (${url}). Vercel serves the app over ` +
          'https, so browsers would block API calls as mixed content. Use the ' +
          'https:// backend URL (e.g. https://...onrender.com).'
      );
    }
    const host = parsed.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
      report(
        strict ? 'error' : 'warn',
        `NEXT_PUBLIC_API_URL points at localhost (${url}). A production build ` +
          'must call the deployed backend URL (e.g. https://...onrender.com).'
      );
    }
    // api.ts appends /api/v1 — a URL with its own path would double up.
    if (parsed.pathname && parsed.pathname !== '/') {
      report(
        'warn',
        `NEXT_PUBLIC_API_URL includes a path "${parsed.pathname}" (${url}). ` +
          'Set it to the bare origin — api.ts appends /api/v1 automatically, ' +
          'so a path here would produce /api/v1/api/v1-style URLs.'
      );
    }
    if (url.endsWith('/')) {
      report(
        'warn',
        `NEXT_PUBLIC_API_URL ends with "/" (${url}). Remove the trailing slash to ` +
          'avoid double slashes in API requests (e.g. https://host//api/v1).'
      );
    }
  }
}

for (const w of warnings) console.warn(`⚠️  ${w}`);
for (const e of errors) console.error(`✋ ${e}`);

console.log('');
if (strict) {
  console.log(`   NEXT_PUBLIC_API_URL = ${url || '(not set)'}`);
  if (errors.length) {
    console.error('🚫 Guard: production build BLOCKED — fix NEXT_PUBLIC_API_URL and redeploy.');
    process.exit(1);
  }
  console.log('✅ NEXT_PUBLIC_API_URL looks correct — proceeding with build.');
} else if (errors.length) {
  // Lenient mode still surfaces hard problems but never blocks local builds.
  console.log('   (Proceeding anyway — this is a local build. Vercel/CI builds are blocked on these.)');
} else if (warnings.length) {
  console.log('   (Proceeding — warnings only.)');
} else {
  console.log('✅ NEXT_PUBLIC_API_URL looks correct — proceeding.');
}
