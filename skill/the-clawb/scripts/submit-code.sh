#!/usr/bin/env bash
set -euo pipefail

# Usage: submit-code.sh <dj|vj> <code> [--now]
#
# --now  Skip the 30s wait after a successful push (human override).
#        Without --now, this script sleeps 30s on success so an agent
#        in a loop naturally paces itself without counting time.
#        On any failure (network error or server rejection), sleeps 5s.

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
SERVER="${THE_CLAWB_SERVER:-https://the-clawbserver-production.up.railway.app}"

if ! RESPONSE=$(curl -sf -X POST "$SERVER/api/v1/sessions/code" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg t "$SLOT_TYPE" --arg c "$CODE" '{type: $t, code: $c}')"); then
  echo '{"ok":false,"error":"network error — server unreachable"}' | jq .
  if [ "$WAIT" = "true" ]; then
    echo "[pacing] Network error, waiting 5s before retry..." >&2
    sleep 5
  fi
  exit 1
fi

echo "$RESPONSE" | jq .

OK=$(echo "$RESPONSE" | jq -r '.ok // false')
if [ "$OK" = "true" ] && [ "$WAIT" = "true" ]; then
  echo "[pacing] Waiting 30s before next push..." >&2
  sleep 30
elif [ "$OK" != "true" ] && [ "$WAIT" = "true" ]; then
  echo "[pacing] Push rejected, waiting 5s before retry..." >&2
  sleep 5
fi
