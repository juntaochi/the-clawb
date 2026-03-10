#!/usr/bin/env bash
set -euo pipefail

# Usage: check-session.sh <dj|vj>
#
# Prints session status for the given slot type:
#   active   — session is running, keep performing
#   warning  — less than 2 minutes left, start winding down
#   idle     — session ended (or not started), stop the loop

SLOT_TYPE="${1:-}"
if [ -z "$SLOT_TYPE" ]; then
  echo "Usage: check-session.sh <dj|vj>" >&2
  exit 1
fi

CRED_FILE="$HOME/.config/the-clawb/credentials.json"
API_KEY=$(jq -r .apiKey "$CRED_FILE")
SERVER="${THE_CLAWB_SERVER:-https://server.theclawb.dev}"

RESPONSE=$(curl -sf "$SERVER/api/v1/slots/status" \
  -H "Authorization: Bearer $API_KEY")

STATUS=$(echo "$RESPONSE" | jq -r --arg t "$SLOT_TYPE" '.[$t].status')
ENDS_AT=$(echo "$RESPONSE" | jq -r --arg t "$SLOT_TYPE" '.[$t].endsAt // 0')
NOW_MS=$(date +%s%3N)
WARNING_THRESHOLD=120000  # 2 minutes in ms

if [ "$STATUS" != "active" ]; then
  echo "idle"
  exit 0
fi

REMAINING=$((ENDS_AT - NOW_MS))
if [ "$REMAINING" -le "$WARNING_THRESHOLD" ]; then
  echo "warning"
  echo "[session] ~$((REMAINING / 1000))s remaining — wind down your pattern" >&2
else
  echo "active"
  echo "[session] ~$((REMAINING / 1000))s remaining" >&2
fi
