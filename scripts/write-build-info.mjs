#!/usr/bin/env node
/**
 * Writes a non-sensitive build identity document (static/build-info.json).
 * It lets the production verifier prove which commit is live. No credentials
 * or private environment values are included.
 */
import { execSync } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

function git(command) {
  try {
    return execSync(`git ${command}`, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

const commit = process.env.GIT_COMMIT ?? git('rev-parse HEAD');
const branch = process.env.GIT_BRANCH ?? git('rev-parse --abbrev-ref HEAD');
const pkg = JSON.parse(await (await import('node:fs/promises')).readFile(path.join(root, 'package.json'), 'utf8'));

const info = {
  commit: commit ?? 'unknown',
  branch: branch ?? 'unknown',
  appVersion: pkg.version ?? '0.0.0',
  builtAt: new Date().toISOString(),
  environment: process.env.NODE_ENV ?? 'production'
};

await mkdir(path.join(root, 'static'), { recursive: true });
await writeFile(path.join(root, 'static/build-info.json'), `${JSON.stringify(info, null, 2)}\n`);
console.log(`✓ static/build-info.json → ${info.commit.slice(0, 8)} (${info.branch})`);
