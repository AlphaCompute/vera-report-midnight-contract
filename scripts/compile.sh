#!/usr/bin/env bash
set -euo pipefail
compiler="${COMPACTC:-compactc}"
if [[ "$($compiler --version)" != "0.30.0" ]]; then
  echo 'Compact 0.30.0 is required (ledger 8 / runtime 0.15.0).' >&2
  exit 1
fi
# Only the reviewed evidence contract is a deployment target.
"$compiler" ${COMPACT_SKIP_ZK:+--skip-zk} contracts/midnight/whistleblower.compact contracts/midnight/managed/whistleblower
