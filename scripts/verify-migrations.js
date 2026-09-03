/**
 * Migration deploy guard — verifies that every directory inside
 * prisma/migrations contains a migration.sql file before running
 * `prisma migrate deploy`.
 *
 * Prevents the Prisma P3015 error ("Could not find the migration file at
 * migration.sql") caused by stray/empty directories (e.g. leftovers from an
 * interrupted `prisma migrate dev --create-only`).
 *
 * Usage:
 *   npm run db:verify                 → report problems only
 *   npm run db:verify -- --clean      → report + remove stray directories
 *                                        that are NOT tracked by git
 *                                        (safe: anything git tracks is
 *                                        never touched)
 *
 * Exit codes:
 *   0 → ready to deploy
 *   1 → problems found (re-run after --clean to confirm)
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');
const CLEAN = process.argv.includes('--clean');

function isDirectory(entryPath) {
  try {
    return fs.statSync(entryPath).isDirectory();
  } catch {
    return false;
  }
}

/** True when git tracks at least one file inside this migration folder. */
function isTrackedByGit(entryName) {
  try {
    const output = execFileSync(
      'git',
      ['ls-files', `prisma/migrations/${entryName}/`],
      { cwd: path.join(__dirname, '..'), encoding: 'utf8' },
    );
    return output.trim().length > 0;
  } catch {
    // git unavailable → treat as tracked (fail safe, never delete).
    return true;
  }
}

function main() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error('❌ prisma/migrations not found.');
    process.exit(1);
  }

  const entries = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((entry) => isDirectory(path.join(MIGRATIONS_DIR, entry)));

  const missing = [];

  for (const entry of entries) {
    const sqlPath = path.join(MIGRATIONS_DIR, entry, 'migration.sql');
    if (!fs.existsSync(sqlPath)) {
      missing.push({ entry, tracked: isTrackedByGit(entry) });
    }
  }

  if (missing.length === 0) {
    console.log(`✅ Verified: ${entries.length} migration folders, all contain migration.sql.`);
    console.log('   Ready to deploy — run:  npm run db:deploy');
    process.exit(0);
  }

  console.error(`❌ Found ${missing.length} migration folder(s) without migration.sql:`);
  for (const item of missing) {
    const tag = item.tracked
      ? 'TRACKED BY GIT — restore the file, do NOT delete'
      : 'not tracked by git (stray/empty folder — safe to clean)';
    console.error(`   - ${item.entry}  [${tag}]`);
  }

  const cleanable = missing.filter((item) => !item.tracked);

  if (CLEAN && cleanable.length > 0) {
    for (const item of cleanable) {
      const target = path.join(MIGRATIONS_DIR, item.entry);
      try {
        fs.rmSync(target, { recursive: true, force: true });
        console.error(`   🧹 removed stray folder: ${item.entry}`);
      } catch (error) {
        console.error(`   ⚠️ could not remove ${item.entry}: ${error.message}`);
      }
    }
    const remaining = missing.filter((item) => item.tracked);
    if (remaining.length === 0) {
      console.error('   Re-run `npm run db:verify` to confirm everything is clean.');
    }
  }

  const stillBroken = missing.filter((item) => !(CLEAN && !item.tracked));
  if (stillBroken.length > 0) {
    console.error('');
    console.error('   For TRACKED folders with a missing file, restore it from git:');
    console.error('     git checkout -- "prisma/migrations/<folder>/migration.sql"');
    console.error('   or hard-reset the migrations directory if corrupted:');
    console.error('     git checkout HEAD -- prisma/migrations');
  }

  process.exit(1);
}

main();
