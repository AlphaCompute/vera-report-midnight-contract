import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Rebuild here rather than falsely associate stale artifacts with current source.
const env = { ...process.env };
delete env.COMPACT_SKIP_ZK;
const build = spawnSync('bash', ['scripts/compile.sh'], { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
if (build.stdout) process.stderr.write(build.stdout);
if (build.stderr) process.stderr.write(build.stderr);
if (build.error || build.status !== 0) throw new Error('Full contract build failed; no manifest emitted');
const managed = 'contracts/midnight/managed/whistleblower';
const info = JSON.parse(readFileSync(resolve(root, managed, 'compiler/contract-info.json'), 'utf8'));
if (info['compiler-version'] !== '0.30.0' || info['runtime-version'] !== '0.15.0') throw new Error('Unexpected toolchain');
for (const circuit of ['submitEvidenceV2', 'verifySubmissionV2']) {
  for (const kind of ['prover', 'verifier']) {
    if (!readFileSync(resolve(root, managed, 'keys', `${circuit}.${kind}`)).length) throw new Error('Empty proving artifact');
  }
}
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Artifact symlinks are not supported');
    return entry.isDirectory() ? files(path) : [relative(root, path)];
  });
}
const paths = ['contracts/midnight/whistleblower.compact', 'package-lock.json', 'client/commitments.mjs', ...files(resolve(root, managed))].sort();
const sha256 = Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex')]));
process.stdout.write(JSON.stringify({ schema: 'vera:evidence-build:v2', compiler: '0.30.0', runtime: '0.15.0', deploymentVerified: false, sha256 }, null, 2) + '\n');
