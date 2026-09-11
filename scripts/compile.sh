#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
compiler="${COMPACTC:-compactc}"
if [[ "$("$compiler" --version)" != "0.30.0" ]]; then
  echo 'Compact 0.30.0 is required (ledger 8 / runtime 0.15.0).' >&2
  exit 1
fi
flags=()
case "${COMPACT_SKIP_ZK:-0}" in
  0) ;;
  1) flags+=(--skip-zk) ;;
  *) echo 'COMPACT_SKIP_ZK must be 0 or 1.' >&2; exit 1 ;;
esac
output="${COMPACT_OUTPUT_DIR:-contracts/midnight/managed/whistleblower}"
"$compiler" "${flags[@]}" contracts/midnight/whistleblower.compact "$output"
# compactc can exit successfully after warning that zkir is unavailable.
# Such a build is not a successful full proving-artifact build.
if [[ "${COMPACT_SKIP_ZK:-0}" == 0 ]]; then
  for circuit in submitEvidenceV2 verifySubmissionV2; do
    for kind in prover verifier; do
      [[ -s "$output/keys/$circuit.$kind" ]] || { echo "Missing proving artifact: $circuit.$kind" >&2; exit 1; }
    done
  done
fi
