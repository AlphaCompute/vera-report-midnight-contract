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
