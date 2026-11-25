/**
 * Install the GitHub Actions workflow.
 *
 * GitHub refuses to accept `.github/workflows/*` from a token without the
 * `workflow` scope, so the workflow lives in `ops/ci/` (always committed and
 * reviewed) and is installed with one command once the scope is granted:
 *
 *   gh auth refresh -s workflow
 *   npm run ci:install
 *
 * The script copies the reviewed file into place, commits it and pushes.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'ops/ci/github-actions.yml';
const TARGET = '.github/workflows/ci.yml';

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: 'inherit', ...options });
}

function scopes() {
  try {
    const output = execFileSync('gh', ['auth', 'status'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return output;
  } catch (error) {
    return String(error.stdout ?? '') + String(error.stderr ?? '');
  }
}

if (!existsSync(SOURCE)) {
  console.error(`Missing ${SOURCE}.`);
  process.exit(1);
}

const status = scopes();
if (!status.includes('workflow')) {
  console.error('This token cannot create workflow files yet. Grant the scope first:\n');
  console.error('  gh auth refresh -s workflow\n');
  console.error('Then run this script again. The workflow file stays in ops/ci/ until then,');
  console.error('so nothing is lost — it is reviewed and versioned like any other file.');
  process.exit(1);
}

mkdirSync('.github/workflows', { recursive: true });
copyFileSync(SOURCE, TARGET);
console.log(`Installed ${TARGET}`);

// The workflow is kept out of the repo by `.git/info/exclude` until the scope
// exists, so lift that exclusion before staging the file.
const excludePath = '.git/info/exclude';
if (existsSync(excludePath)) {
  const before = readFileSync(excludePath, 'utf8');
  const after = before
    .split(/\r?\n/)
    .filter((line) => !line.includes('.github/workflows/ci.yml'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
  if (after !== before) {
    writeFileSync(excludePath, after);
    console.log('Removed the local exclusion for .github/workflows/ci.yml');
  }
}

run('git', ['add', '-f', TARGET]);
run('git', ['-c', 'user.name=CaveBettor', '-c', 'user.email=dev@cavebettor.local', 'commit', '-m', 'CI: install the GitHub Actions workflow']);
run('git', ['push', 'origin', 'main']);
console.log('Pushed. Actions will run on the next push.');
