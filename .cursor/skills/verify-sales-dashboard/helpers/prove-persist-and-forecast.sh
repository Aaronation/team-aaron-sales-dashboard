#!/usr/bin/env bash
# Launch, doctor, drive persist-and-forecast, cleanup, then prove the evidence files are still on disk.
set -euo pipefail
export LANG="${LANG:-C.UTF-8}"
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"
V=(node "$ROOT/.cursor/skills/verify-sales-dashboard/helpers/verify.mjs")
DRIVE="$ROOT/.cursor/skills/verify-sales-dashboard/features/persist-and-forecast.drive.sh"

cleanup() {
  "${V[@]}" cleanup || true
}
trap cleanup EXIT

"${V[@]}" launch
"${V[@]}" doctor
bash "$DRIVE"

EVIDENCE="$("${V[@]}" paths | sed -n 's/^evidence_dir=//p')"
SERVER_PID="$("${V[@]}" paths | sed -n 's/^server_pid=//p')"
test -n "$EVIDENCE"
test -d "$EVIDENCE"

"${V[@]}" cleanup
trap - EXIT

for f in \
  doctor.txt \
  journal.jsonl \
  hashes.json \
  01-seed-forecast.png \
  01-seed-forecast.aria.txt \
  02-reload-forecast.png \
  02-reload-forecast.aria.txt \
  03-reload-import.png \
  04-replace-reload.png
do
  test -s "$EVIDENCE/$f"
done

if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
  echo "server pid ${SERVER_PID} still alive after cleanup" >&2
  exit 1
fi

echo "evidence_survived=${EVIDENCE}"
find "$EVIDENCE" -maxdepth 1 -type f -printf '%f\n' | sort
