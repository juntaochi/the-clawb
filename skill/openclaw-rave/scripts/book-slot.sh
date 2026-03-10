#!/usr/bin/env bash
set -euo pipefail

SLOT_TYPE="${1:-}"
if [ -z "$SLOT_TYPE" ] || [[ ! "$SLOT_TYPE" =~ ^(dj|vj)$ ]]; then
  echo "Usage: book-slot.sh <dj|vj>" >&2
  exit 1
fi

CRED_FILE="$HOME/.config/openclaw-rave/credentials.json"
API_KEY=$(jq -r .apiKey "$CRED_FILE")
SERVER="${OPENCLAW_RAVE_SERVER:-https://rave-server.openclaw.dev}"

RESPONSE=$(curl -sf -X POST "$SERVER/api/v1/slots/book" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg t "$SLOT_TYPE" '{type: $t}')")

echo "$RESPONSE" | jq .
