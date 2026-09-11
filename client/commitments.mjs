import { randomBytes } from 'node:crypto';
import { CompactTypeBytes, CompactTypeVector, persistentCommit } from '@midnight-ntwrk/compact-runtime';

const bytes32 = new CompactTypeBytes(32);
const tag = text => Uint8Array.from(Buffer.concat([Buffer.from(text), Buffer.alloc(32 - Buffer.byteLength(text))]));
function checked(value, name, nonzero = false) {
  if (!(value instanceof Uint8Array) || value.length !== 32 || (nonzero && value.every(byte => byte === 0))) {
    throw new TypeError(`${name} must be ${nonzero ? 'nonzero ' : ''}32-byte Uint8Array`);
  }
  return value;
}

// Persist the result in protected application storage BEFORE proving/submitting.
// Reuse it only for reconciliation/retry of the same submission. Never log it,
// put it in public signals, or send it to an untrusted proof server.
export function createOpening() {
  let opening;
  do { opening = new Uint8Array(randomBytes(32)); } while (opening.every(byte => byte === 0));
  return opening;
}
export function createDeploymentDomain() { return createOpening(); }

// Uses the pinned Compact runtime encoding, never an ad hoc concatenation hash.
// Returns only public values; the private opening is intentionally excluded.
export function publicReceipt(domain, evidenceHash, opening) {
  checked(domain, 'domain', true);
  checked(evidenceHash, 'evidenceHash');
  checked(opening, 'opening', true);
  return {
    protocol: 'vera:evidence:v2',
    commitment: persistentCommit(new CompactTypeVector(3, bytes32), [tag('vera:evidence:v2'), domain, evidenceHash], opening),
    submissionTag: persistentCommit(new CompactTypeVector(2, bytes32), [tag('vera:submission:v2'), domain], opening),
  };
}
