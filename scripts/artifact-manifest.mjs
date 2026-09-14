import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdtempSync, lstatSync, rmSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const managed = 'contracts/midnight/managed/whistleblower';
const inputs = ['contracts/midnight/whistleblower.compact', 'package.json', 'package-lock.json', 'client/commitments.mjs', 'scripts/compile.sh', 'scripts/artifact-manifest.mjs'];
function digest(path) {
  if (!lstatSync(path).isFile()) throw new Error('Only regular files may enter the manifest');
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
const before = Object.fromEntries(inputs.map(path => [path, digest(resolve(root, path))]));
// A fresh private directory prevents another build or leftover keys from being
// mistaken for this invocation's output. Never reuse COMPACT_OUTPUT_DIR here.
const isolated = mkdtempSync(resolve(tmpdir(), 'vera-contract-build-'));
let completed = false;
try {
  const env = { ...process.env, COMPACT_SKIP_ZK: '0', COMPACT_OUTPUT_DIR: resolve(isolated, 'artifacts') };
  const build = spawnSync('bash', ['scripts/compile.sh'], { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (build.stdout) process.stderr.write(build.stdout);
  if (build.stderr) process.stderr.write(build.stderr);
  if (build.error || build.status !== 0) throw new Error('Full contract build failed; no manifest emitted');
  for (const path of inputs) {
    if (digest(resolve(root, path)) !== before[path]) throw new Error('Build input changed during compilation; no manifest emitted');
  }
  const info = JSON.parse(readFileSync(resolve(env.COMPACT_OUTPUT_DIR, 'compiler/contract-info.json'), 'utf8'));
  if (info['compiler-version'] !== '0.30.0' || info['language-version'] !== '0.22.0' || info['runtime-version'] !== '0.15.0') throw new Error('Unexpected toolchain');
  if (JSON.stringify(info.circuits.map(c => c.name).sort()) !== JSON.stringify(['submitEvidenceV2', 'verifySubmissionV2'])) throw new Error('Unexpected circuit exports');
  function files(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const path = resolve(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Artifact symlinks are not supported');
      return entry.isDirectory() ? files(path) : [path];
    });
  }
  const artifacts = Object.fromEntries(files(env.COMPACT_OUTPUT_DIR).sort().map(path => [`${managed}/${relative(env.COMPACT_OUTPUT_DIR, path)}`, digest(path)]));
  process.stdout.write(JSON.stringify({ schema: 'vera:evidence-build:v2', compiler: '0.30.0', runtime: '0.15.0', deploymentVerified: false, artifactDirectory: env.COMPACT_OUTPUT_DIR, sha256: { ...before, ...artifacts } }, null, 2) + '\n');
  completed = true;
} finally {
  // Keep successful artifacts for deployment/archive; clean only failed builds.
  if (!completed) rmSync(isolated, { recursive: true, force: true });
}
