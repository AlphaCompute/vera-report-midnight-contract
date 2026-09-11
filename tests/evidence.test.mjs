import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createConstructorContext, createCircuitContext, dummyContractAddress } from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger } from '../contracts/midnight/managed/whistleblower/contract/index.js';
const key = '00'.repeat(32);
const bytes = n => new Uint8Array(32).fill(n);
function setup() {
  const contract = new Contract({});
  const initial = contract.initialState(createConstructorContext({}, key));
  let context = createCircuitContext(dummyContractAddress(), key, initial.currentContractState, initial.currentPrivateState);
  return {
    state: () => ledger(context.currentQueryContext.state),
    call(name, ...args) {
      const result = contract.circuits[name](context, ...args);
      context = result.context;
      return result.result;
    }
  };
}
test('membership rejects arbitrary evidence even with the correct public accumulator', () => {
  const s = setup();
  s.call('submitEvidence', bytes(1), bytes(2));
  const root = s.state().evidenceAccumulator;
  assert.equal(s.call('verifySubmission', bytes(1), root), 1n);
  assert.throws(() => s.call('verifySubmission', bytes(3), root), /Evidence not submitted/);
});
test('duplicate nullifier cannot submit a second evidence commitment', () => {
  const s = setup();
  s.call('submitEvidence', bytes(1), bytes(2));
  assert.throws(() => s.call('submitEvidence', bytes(3), bytes(2)), /Nullifier already used/);
  assert.equal(s.state().evidenceCount, 1n);
  assert.equal(s.state().submittedEvidence.member(bytes(3)), false);
});
test('historical evidence remains verifiable against current root; stale roots reject', () => {
  const s = setup();
  s.call('submitEvidence', bytes(1), bytes(2));
  const old = s.state().evidenceAccumulator;
  s.call('submitEvidence', bytes(3), bytes(4));
  assert.equal(s.state().evidenceCount, 2n);
  assert.equal(s.call('verifySubmission', bytes(1), s.state().evidenceAccumulator), 1n);
  assert.throws(() => s.call('verifySubmission', bytes(1), old), /Accumulator mismatch/);
});
test('an empty ledger never verifies an arbitrary or zero commitment', () => {
  const s = setup();
  for (const value of [bytes(0), bytes(99)]) {
    assert.throws(() => s.call('verifySubmission', value, s.state().evidenceAccumulator), /Evidence not submitted/);
  }
  assert.equal(s.state().evidenceCount, 0n);
});
test('replay leaves both roots unchanged and does not poison subsequent submissions', () => {
  const s = setup();
  s.call('submitEvidence', bytes(1), bytes(2));
  const evidenceRoot = s.state().evidenceAccumulator;
  const nullifierRoot = s.state().nullifierAccumulator;
  assert.throws(() => s.call('submitEvidence', bytes(1), bytes(2)), /Nullifier already used/);
  assert.deepEqual(s.state().evidenceAccumulator, evidenceRoot);
  assert.deepEqual(s.state().nullifierAccumulator, nullifierRoot);
  s.call('submitEvidence', bytes(3), bytes(4));
  assert.equal(s.state().evidenceCount, 2n);
  assert.equal(s.call('verifySubmission', bytes(3), s.state().evidenceAccumulator), 1n);
});
test('fresh nullifiers permit repeated evidence: this is not an anti-spam protocol', () => {
  const s = setup();
  s.call('submitEvidence', bytes(1), bytes(2));
  s.call('submitEvidence', bytes(1), bytes(3));
  assert.equal(s.state().evidenceCount, 2n);
  assert.equal(s.state().usedNullifiers.member(bytes(2)), true);
  assert.equal(s.state().usedNullifiers.member(bytes(3)), true);
  assert.equal(s.call('verifySubmission', bytes(1), s.state().evidenceAccumulator), 1n);
});
test('membership does not carry between contract instances', () => {
  const a = setup(), b = setup();
  a.call('submitEvidence', bytes(1), bytes(2));
  b.call('submitEvidence', bytes(3), bytes(4));
  assert.throws(() => b.call('verifySubmission', bytes(1), b.state().evidenceAccumulator), /Evidence not submitted/);
});
