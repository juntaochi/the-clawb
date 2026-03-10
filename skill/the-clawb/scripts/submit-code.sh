#!/usr/bin/env bash
set -euo pipefail

# Usage: submit-code.sh <dj|vj> <code> [--now]
#
# --now  Skip the 30s wait after a successful push (human override).
#        Without --now, this script sleeps 30s on success so an agent
#        in a loop naturally paces itself without counting time.

WAIT=true
ARGS=()
for arg in "$@"; do
  if [ "$arg" = "--now" ]; then
    WAIT=false
  else
    ARGS+=("$arg")
  fi
done

SLOT_TYPE="${ARGS[0]:-}"
CODE="${ARGS[*]:1}"

if [ -z "$SLOT_TYPE" ] || [ -z "$CODE" ]; then
  echo "Usage: submit-code.sh <dj|vj> <code> [--now]" >&2
  exit 1
fi

CRED_FILE="$HOME/.config/the-clawb/credentials.json"
API_KEY=$(jq -r .apiKey "$CRED_FILE")
SERVER="${THE_CLAWB_SERVER:-https://server.theclawb.dev}"

RESPONSE=$(curl -sf -X POST "$SERVER/api/v1/sessions/code" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg t "$SLOT_TYPE" --arg c "$CODE" '{type: $t, code: $c}')")

echo "$RESPONSE" | jq .

OK=$(echo "$RESPONSE" | jq -r '.ok // false')
if [ "$OK" = "true" ] && [ "$WAIT" = "true" ]; then
  echo "[pacing] Waiting 30s before next push..."
  sleep 30
fi
