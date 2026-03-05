# Vera.Report: Reporting Contract

This project is built on the Midnight Network.

## About Vera.Report

[Vera.Report](https://vera.report) is an anonymous whistleblowing platform that enables real-time, anonymous reporting of fraud, waste, and abuse through smartphones via Telegram Messenger. Vera collects zero identity data — submitted evidence is technically impossible to access without permission from the person who provided it, eliminating breach and subpoena risks.

The platform uses zero-knowledge proofs and rate-limit nullifiers to protect whistleblowers while preventing spam. Privacy is enforced at the protocol level through the Midnight Network, a privacy-enhancing blockchain founded by Charles Hoskinson.

## Deployment

| | Hash |
|---|---|
| **Contract** | `79b734825fd136542162ce1f17b6d477583ea0e189b4944418706e62310a325d` |
| **Transaction** | [`00e955d977facbc568c29101e92799e68c88a94570d5bf1f5c0dc6efa6ffc64c5d`](https://www.midnightexplorer.com/tx/0x97d5d5c0b796fa756b6795436bab5274808434449fb6acbfee30782afcd35273) |

## Contracts

### Whistleblower (`whistleblower.compact`)

The core evidence submission contract. Each report is hashed and committed on-chain via a rolling accumulator, producing a tamper-proof audit trail without revealing the content or identity of the submitter.

- **`submitEvidence`** — Accepts an evidence hash and a nullifier, extends both the evidence and nullifier accumulators, and increments the on-chain evidence counter.
- **`verifySubmission`** — Allows anyone to verify that a specific evidence hash is included in the current accumulator.

### Vault (`vault.compact`)

A dead-man's-switch vault for protected asset release. An owner locks assets behind a heartbeat-based timelock; if the owner stops checking in, designated beneficiaries can claim the assets.

- **`createVault`** — Initializes a vault with an owner key, ID, and timelock duration.
- **`addBeneficiary`** — Owner registers a beneficiary via an accumulator commitment.
- **`recordHeartbeat`** — Owner resets the timelock countdown.
- **`releaseVault`** — Releases the vault once the timelock has expired.
- **`claimAsset`** — Beneficiary claims assets from a released vault (single-claim enforced).

### TON Bridge (`midnit_ton.fc`)

FunC contract scaffold for the TON blockchain integration layer.
