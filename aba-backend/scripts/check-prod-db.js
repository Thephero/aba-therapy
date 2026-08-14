#!/usr/bin/env node
/**
 * Guard: prevents production Prisma DB commands (db:generate:prod, db:push:prod,
 * db:seed:prod) from running against a non-Postgres DATABASE_URL.
 *
 * Why this exists: running `npm run db:generate:prod` locally regenerates the
 * Prisma client from the Postgres schema (schema.postgres.prisma), which then
 * breaks local SQLite development — every DB call (including login) returns
 * 500 "Internal server error" until the client is regenerated for SQLite.
 *
 * This guard fails fast with a clear message instead of silently corrupting
 * the local dev client.
 */
const path = require('path');
const fs = require('fs');

// Load .env if present (mirrors src/config/index.ts behaviour)
const dotenvPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(dotenvPath)) {
  require('dotenv').config({ path: dotenvPath });
}

const url = (process.env.DATABASE_URL || '').trim();
const isPostgres = /^postgres(ql)?:\/\//i.test(url);

if (!isPostgres) {
  console.error('✋ Guard: refusing to run a production DB command.');
  console.error(`   DATABASE_URL must start with "postgresql://" or "postgres://".`);
  console.error(`   Current value: ${url || '(not set)'}`);
  console.error('');
  console.error('   To fix local (SQLite) development after an accidental run, use:');
  console.error('     npm run db:restore:local   # regenerates the SQLite client');
  console.error('');
  console.error('   To run the production DB commands on purpose, set DATABASE_URL');
  console.error('   to your Neon Postgres connection string first (e.g. in the');
  console.error('   Render dashboard — it is injected there automatically).');
  process.exit(1);
}

console.log('✅ DATABASE_URL looks like Postgres — proceeding.');
