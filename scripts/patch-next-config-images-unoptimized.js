#!/usr/bin/env node
/**
 * Patch Next.js config(s) in /workspace to be builder-safe:
 * - When SAMUS_BUILDER=1, set images.unoptimized=true (prevents server-side fetch of remote images)
 *
 * Why:
 * - LLMs may introduce non-deterministic remote placeholder image hosts.
 * - Next.js Image Optimization fetches remote images server-side via /_next/image, which can fail on DNS (EAI_AGAIN)
 * - In builder runs we prefer determinism over optimization; production apps can re-enable optimization later.
 *
 * This script is best-effort and idempotent.
 */

const fs = require('fs');
const path = require('path');

const ROOT = '/workspace';
const MARKER = 'samus-builder-images-unoptimized';
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  'coverage',
  'test-results',
  'playwright-report',
  'log',
  '.tmp',
  '.pnpm-store'
]);

const TARGET_NAMES = new Set([
  'next.config.ts',
  'next.config.js',
  'next.config.mjs',
  'next.config.cjs'
]);

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function safeWrite(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch {
    return false;
  }
}

function findNextConfigFiles(dir, depth = 0, maxDepth = 6, out = []) {
  if (depth > maxDepth) return out;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      findNextConfigFiles(full, depth + 1, maxDepth, out);
      continue;
    }
    if (entry.isFile() && TARGET_NAMES.has(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function injectAfterNextConfigObject(source) {
  if (source.includes(MARKER)) return { changed: false, source };

  // Only patch when a `nextConfig` variable exists; avoid breaking configs that export directly.
  const declMatch = source.match(/\b(const|let|var)\s+nextConfig\b/);
  if (!declMatch) return { changed: false, source };

  const declIndex = declMatch.index ?? -1;
  if (declIndex < 0) return { changed: false, source };

  // Find the end of `nextConfig = { ... };` by scanning for the first `};` AFTER the declaration.
  // This intentionally assumes the standard boilerplate pattern.
  const afterDecl = source.slice(declIndex);
  const endStmtRel = afterDecl.indexOf('\n};');
  if (endStmtRel === -1) return { changed: false, source };

  const insertAt = declIndex + endStmtRel + '\n};'.length;

  const snippet =
    `\n\n// ${MARKER}\n` +
    `// In builder runs, disable Next.js Image Optimization to avoid server-side fetch/DNS flakiness\n` +
    `// from non-deterministic remote placeholder image hosts.\n` +
    `if (process.env.SAMUS_BUILDER === '1') {\n` +
    `  nextConfig.images = { ...(nextConfig.images ?? {}), unoptimized: true };\n` +
    `}\n`;

  return {
    changed: true,
    source: source.slice(0, insertAt) + snippet + source.slice(insertAt)
  };
}

function main() {
  if (!fs.existsSync(ROOT)) {
    console.error(`[samus-builder] /workspace not found; skipping Next.js config patch`);
    process.exit(0);
  }

  const files = findNextConfigFiles(ROOT);
  if (files.length === 0) {
    console.error(`[samus-builder] No next.config.* files found; skipping`);
    process.exit(0);
  }

  let patched = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of files) {
    const original = safeRead(filePath);
    if (original == null) {
      failed++;
      continue;
    }

    const { changed, source } = injectAfterNextConfigObject(original);
    if (!changed) {
      skipped++;
      continue;
    }

    if (safeWrite(filePath, source)) {
      patched++;
      console.error(`[samus-builder] Patched: ${path.relative(ROOT, filePath)}`);
    } else {
      failed++;
    }
  }

  console.error(
    `[samus-builder] Next.js image patch summary: patched=${patched} skipped=${skipped} failed=${failed}`
  );

  // Best-effort: do not fail the whole init on patch issues.
  process.exit(0);
}

main();


