#!/usr/bin/env bash
set -euo pipefail

SLOT_TYPE="${1:-}"
shift
CODE="${*:-}"

if [ -z "$SLOT_TYPE" ] || [ -z "$CODE" ]; then
  echo "Usage: submit-code.sh <dj|vj> <code>" >&2
  exit 1
fi

CRED_FILE="$HOME/.config/openclaw-rave/credentials.json"
API_KEY=$(jq -r .apiKey "$CRED_FILE")
SERVER="${OPENCLAW_RAVE_SERVER:-https://rave-server.openclaw.dev}"

RESPONSE=$(curl -sf -X POST "$SERVER/api/v1/sessions/code" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg t "$SLOT_TYPE" --arg c "$CODE" '{type: $t, code: $c}')")

echo "$RESPONSE" | jq .
