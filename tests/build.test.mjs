import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function fixture(t) {
  const dir = mkdtempSync(resolve(tmpdir(), 'vera-build-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const path of ['scripts', 'client', 'package.json', 'package-lock.json']) cpSync(path, resolve(dir, path), { recursive: true });
  mkdirSync(resolve(dir, 'contracts/midnight'), { recursive: true });
  cpSync('contracts/midnight/whistleblower.compact', resolve(dir, 'contracts/midnight/whistleblower.compact'));
  const compiler = resolve(dir, 'fake compiler');
  writeFileSync(compiler, `#!/bin/bash
if [[ "$1" == --version ]]; then echo 0.30.0; exit 0; fi
output="\u0024{!#}"
if [[ "\u0024{FAKE_KEYS:-}" == 1 ]]; then
  mkdir -p "$output/keys" "$output/compiler"
  for c in submitEvidenceV2 verifySubmissionV2; do
    for k in prover verifier; do echo fixture > "$output/keys/$c.$k"; done
  done
  echo '{"compiler-version":"0.30.0","language-version":"0.22.0","runtime-version":"0.15.0","circuits":[{"name":"submitEvidenceV2"},{"name":"verifySubmissionV2"}]}' > "$output/compiler/contract-info.json"
fi
if [[ "\u0024{FAKE_MUTATE:-}" == 1 ]]; then echo '// changed during build' >> client/commitments.mjs; fi
exit 0
`, { mode: 0o700 });
  return { dir, run: (manifest, env = {}) => spawnSync(manifest ? process.execPath : 'bash', [manifest ? 'scripts/artifact-manifest.mjs' : 'scripts/compile.sh'], {
    cwd: dir, env: { ...process.env, COMPACTC: compiler, COMPACT_SKIP_ZK: '0', COMPACT_OUTPUT_DIR: resolve(dir, 'output'), ...env }, encoding: 'utf8',
  }) };
}
test('full build fails when compiler exits zero without proving artifacts', t => {
  const f = fixture(t), r = f.run(false);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Missing proving artifact/);
});
test('skip flag accepts only 0 or 1 and 0 means full build', t => {
  const f = fixture(t);
  assert.equal(f.run(false, { COMPACT_SKIP_ZK: '1' }).status, 0);
  assert.notEqual(f.run(false, { COMPACT_SKIP_ZK: '0' }).status, 0);
  assert.match(f.run(false, { COMPACT_SKIP_ZK: 'false' }).stderr, /must be 0 or 1/);
  assert.equal(f.run(false, { FAKE_KEYS: '1' }).status, 0);
});
test('manifest ignores stale keys and inherited skip/output settings', t => {
  const f = fixture(t);
  assert.equal(f.run(false, { FAKE_KEYS: '1' }).status, 0);
  const r = f.run(true, { COMPACT_SKIP_ZK: '1' });
  assert.notEqual(r.status, 0);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /Missing proving artifact/);
});
test('manifest refuses to certify sources changed during compilation', t => {
  const f = fixture(t), r = f.run(true, { FAKE_KEYS: '1', FAKE_MUTATE: '1' });
  assert.notEqual(r.status, 0);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /Build input changed/);
});

test('ordinary full build cannot reuse keys from an earlier successful build', t => {
  const f = fixture(t);
  assert.equal(f.run(false, { FAKE_KEYS: '1' }).status, 0);
  const result = f.run(false);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing proving artifact/);
});
