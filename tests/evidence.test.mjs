import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ContractState, createConstructorContext, createCircuitContext, dummyContractAddress } from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger } from '../contracts/midnight/managed/whistleblower/contract/index.js';
import { createOpening, createDeploymentDomain, publicReceipt } from '../client/commitments.mjs';
const key = '00'.repeat(32);
const bytes = n => new Uint8Array(32).fill(n);
function setup(domain = bytes(10)) {
  const contract = new Contract({});
  const initial = contract.initialState(createConstructorContext({}, key), domain);
  let context = createCircuitContext(dummyContractAddress(), key, initial.currentContractState, initial.currentPrivateState);
  return {
    contract, domain,
    state: () => ledger(context.currentQueryContext.state),
    call(name, ...args) {
      const result = contract.circuits[name](context, ...args);
      context = result.context;
      return result;
    },
    submit(hash, opening) { return this.call('submitEvidenceV2', hash, opening); },
    verify(hash, opening) { return this.call('verifySubmissionV2', hash, opening); },
  };
}
function snapshot(s) {
  const l = s.state();
  return { domain: l.deploymentDomain, count: l.evidenceCount,
    commitments: [...l.submittedCommitments], tags: [...l.usedSubmissionTags] };
}
function byteValues(value) {
  if (value instanceof Uint8Array) return [Buffer.from(value).toString('hex')];
  if (value && typeof value === 'object') return Object.values(value).flatMap(byteValues);
  return [];
}
test('empty ledger and incorrect evidence/opening do not verify', () => {
  const s = setup();
  assert.throws(() => s.verify(bytes(1), bytes(2)), /Evidence not submitted/);
  s.submit(bytes(1), bytes(2));
  assert.equal(s.verify(bytes(1), bytes(2)).result, 1n);
  assert.throws(() => s.verify(bytes(3), bytes(2)), /Evidence not submitted/);
  assert.throws(() => s.verify(bytes(1), bytes(3)), /Evidence not submitted/);
});
test('replay and rebinding an opening to different evidence leave all state unchanged', () => {
  const s = setup();
  s.submit(bytes(1), bytes(2));
  const before = snapshot(s);
  for (const hash of [bytes(1), bytes(3)]) {
    assert.throws(() => s.submit(hash, bytes(2)), /already used/);
    assert.deepEqual(snapshot(s), before);
  }
  s.submit(bytes(3), bytes(4));
  assert.equal(s.state().evidenceCount, 2n);
});
test('same evidence with fresh randomness produces unlinkable-by-equality public values', () => {
  const s = setup();
  s.submit(bytes(1), bytes(2));
  s.submit(bytes(1), bytes(3));
  assert.equal(s.state().submittedCommitments.size(), 2n);
  assert.equal(s.state().usedSubmissionTags.size(), 2n);
});
test('verification survives intervening submissions and does not mutate state', () => {
  const s = setup();
  s.submit(bytes(1), bytes(2));
  s.submit(bytes(3), bytes(4));
  const before = snapshot(s);
  assert.equal(s.verify(bytes(1), bytes(2)).result, 1n);
  assert.deepEqual(snapshot(s), before);
});
test('ledger and public query transcripts contain no raw evidence hash or opening', () => {
  const s = setup(), evidence = bytes(71), opening = bytes(89);
  const submission = s.submit(evidence, opening);
  const verification = s.verify(evidence, opening);
  assert(submission.proofData.publicTranscript.length > 0);
  assert(verification.proofData.publicTranscript.length > 0);
  const observed = byteValues([snapshot(s), submission.proofData.publicTranscript, verification.proofData.publicTranscript]);
  const receipt = publicReceipt(s.domain, evidence, opening);
  assert(observed.includes(Buffer.from(receipt.commitment).toString('hex')));
  assert(observed.includes(Buffer.from(receipt.submissionTag).toString('hex')));
  for (const secret of [evidence, opening]) assert(!observed.includes(Buffer.from(secret).toString('hex')));
});
test('public values cannot be substituted for the private opening', () => {
  const s = setup(), hash = bytes(1), opening = bytes(2);
  const receipt = publicReceipt(s.domain, hash, opening);
  s.submit(hash, opening);
  for (const guessed of [receipt.commitment, receipt.submissionTag]) {
    assert.throws(() => s.verify(hash, guessed), /Evidence not submitted/);
  }
});
test('client receipt derivation agrees with compiled circuits across domains and inputs', () => {
  for (let i = 1; i <= 5; i++) {
    const s = setup(bytes(i)), opening = createOpening(), hash = bytes(i + 20);
    const receipt = publicReceipt(s.domain, hash, opening);
    s.submit(hash, opening);
    assert(s.state().submittedCommitments.member(receipt.commitment));
    assert(s.state().usedSubmissionTags.member(receipt.submissionTag));
    assert.notDeepEqual(receipt.commitment, receipt.submissionTag);
    assert.deepEqual(Object.keys(receipt), ['protocol', 'commitment', 'submissionTag']);
  }
});
test('deployment domains separate commitments and tags and membership is instance-local', () => {
  const a = setup(bytes(10)), b = setup(bytes(11));
  const ra = publicReceipt(a.domain, bytes(1), bytes(2)), rb = publicReceipt(b.domain, bytes(1), bytes(2));
  assert.notDeepEqual(ra.commitment, rb.commitment);
  assert.notDeepEqual(ra.submissionTag, rb.submissionTag);
  a.submit(bytes(1), bytes(2));
  assert.throws(() => b.verify(bytes(1), bytes(2)), /Evidence not submitted/);
});
test('reject zero domain/opening, invalid input lengths and legacy circuit calls', () => {
  assert.throws(() => setup(bytes(0)), /domain must be nonzero/);
  const s = setup();
  assert.throws(() => s.submit(bytes(1), bytes(0)), /Opening must be nonzero/);
  assert.throws(() => s.submit(new Uint8Array(31), bytes(2)));
  assert.throws(() => publicReceipt(bytes(10), bytes(1), bytes(0)), /nonzero/);
  assert.throws(() => publicReceipt(bytes(10), new Uint8Array(33), bytes(2)), /32-byte/);
  assert.equal(s.contract.circuits.submitEvidence, undefined);
  assert.equal(s.contract.circuits.verifySubmission, undefined);
  assert.equal(s.state().evidenceCount, 0n);
});
test('secure generators produce independent nonzero 32-byte values', () => {
  const values = [createOpening(), createOpening(), createDeploymentDomain()];
  for (const value of values) { assert.equal(value.length, 32); assert(value.some(byte => byte !== 0)); }
  assert.equal(new Set(values.map(value => Buffer.from(value).toString('hex'))).size, 3);
});

test('mixed adversarial histories preserve membership and count across ledger serialization', () => {
  const contract = new Contract({});
  const domain = createDeploymentDomain();
  const initial = contract.initialState(createConstructorContext({}, key), domain);
  let context = createCircuitContext(dummyContractAddress(), key, initial.currentContractState, initial.currentPrivateState);
  const accepted = [];
  for (let i = 0; i < 24; i++) {
    const hash = bytes(i % 4 + 1), opening = createOpening();
    context = contract.circuits.submitEvidenceV2(context, hash, opening).context;
    accepted.push({ hash, opening });
    // Recreate a reader from serialized public state, not the submitting instance.
    initial.currentContractState.data = context.currentQueryContext.state;
    const restored = ContractState.deserialize(initial.currentContractState.serialize());
    const reader = createCircuitContext(dummyContractAddress(), key, restored, {});
    const previous = accepted[Math.floor(i / 2)];
    assert.equal(contract.circuits.verifySubmissionV2(reader, previous.hash, previous.opening).result, 1n);
    const changed = new Uint8Array(previous.opening); changed[i % 32] ^= 1;
    assert.throws(() => contract.circuits.verifySubmissionV2(reader, previous.hash, changed), /Evidence not submitted/);
    assert.throws(() => contract.circuits.submitEvidenceV2(reader, hash, previous.opening), /already used/);
    const state = ledger(context.currentQueryContext.state);
    assert.equal(state.evidenceCount, BigInt(i + 1));
    assert.equal(state.submittedCommitments.size(), BigInt(i + 1));
    assert.equal(state.usedSubmissionTags.size(), BigInt(i + 1));
  }
});
