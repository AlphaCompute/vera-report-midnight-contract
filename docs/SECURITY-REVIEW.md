# Security review — September 11, 2026

Scope: all source files in this private repository. This is a source review and executable circuit regression check, not an independent audit or a guarantee of no defects.

## Evidence contract — repaired

- **High: false membership verification.** `verifySubmission` ignored `evidenceHash`; any hash passed when given the public accumulator. The new public commitment set requires actual membership. Tests exercise an unrelated hash with the correct root and historical membership after another insertion.
- **High: duplicate nullifiers accepted on-chain.** A hash accumulator cannot enforce uniqueness. The new nullifier set rejects replay in the circuit. The application-side database remains a defense in depth, not the contract authority. The failed replay regression checks that neither count nor membership changes.
- **Remaining design limits:** unrestricted callers can submit arbitrary commitments and fresh nullifiers; this is not Sybil resistance, identity authorization, evidence validity, encryption or an anti-spam rate limit. Public sets increase storage and expose commitments/nullifiers. Never submit plaintext evidence or identity-derived low-entropy values. Historical membership and nullifier state do not migrate automatically.

## Vault — critical, excluded from deployment

The old scaffold is retained in `legacy/vault.compact` for reference only. It fails to parse on Compact 0.30.0 and has no deployable artifact here.

- `createVault` can reset ownership and state without a one-time initialization guard.
- Owner checks compare a caller argument to a public ledger key, so knowledge of that public key substitutes for authority.
- `currentTime` is an unconstrained caller witness; it cannot enforce expiry or heartbeat time.
- Claim checks compare a supplied public accumulator to its ledger value without proving beneficiary membership or secret ownership.
- Comparing a newly computed hash to the previous accumulator does not enforce one claim per beneficiary.
- No asset custody, asset registration, balance accounting or transfer is implemented despite the previous README claim.

Do not patch these into an apparent asset vault without an agreed custody and authorization model. A replacement needs constructor-only initialization, secret/signature authorization, ledger-constrained time, explicit beneficiary membership, consumed-claim state and actual asset transfer invariants, with adversarial circuit tests and an independent audit before funds are placed at risk.

## TON — excluded from deployment

`legacy/midnit_ton.fc` has an empty internal-message handler and implements no bridge or withdrawal behavior. It must not receive assets. The vendored standard library is dependency code, not a bridge implementation.

## Assurance and migration

The evidence regression suite executes compiler-generated circuits using the pinned runtime. Full proving-key generation and a network proof/receipt run are separate checks. Reconcile generated artifacts in the application repository and perform an explicit new-address rollout; do not silently change historical verification semantics. No active contract or wallet was modified during this review.
