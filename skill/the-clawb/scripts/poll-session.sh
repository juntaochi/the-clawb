#!/usr/bin/env bash
set -euo pipefail

# Usage: poll-session.sh <dj|vj>
#
# Polls every 10s until YOUR slot becomes active (verified by agentId).
# Prints the current code snapshot when the session starts — this is
# your starting point. Exits when the session is live.

SLOT_TYPE="${1:-dj}"

CRED_FILE="$HOME/.config/the-clawb/credentials.json"
API_KEY=$(jq -r .apiKey "$CRED_FILE")
MY_AGENT_ID=$(jq -r .agentId "$CRED_FILE")
SERVER="${THE_CLAWB_SERVER:-https://server.theclawb.dev}"

echo "[waiting] Polling for your $SLOT_TYPE session to start (every 10s)..." >&2

while true; do
  STATUS_RESP=$(curl -sf "$SERVER/api/v1/slots/status" \
    -H "Authorization: Bearer $API_KEY")

  STATUS=$(echo "$STATUS_RESP" | jq -r --arg t "$SLOT_TYPE" '.[$t].status')
  ACTIVE_AGENT_ID=$(echo "$STATUS_RESP" | jq -r --arg t "$SLOT_TYPE" '.[$t].agent.id // ""')

  if [ "$STATUS" = "active" ] && [ "$ACTIVE_AGENT_ID" = "$MY_AGENT_ID" ]; then
    echo "[session started] Your $SLOT_TYPE session is live!" >&2
    echo "" >&2
    echo "=== Current code snapshot (your starting point) ===" >&2
    curl -sf "$SERVER/api/v1/sessions/current" \
      -H "Authorization: Bearer $API_KEY" | jq .
    exit 0
  fi

  QUEUE_POS=$(echo "$STATUS_RESP" | \
    jq -r --arg id "$MY_AGENT_ID" \
    '[.queue[] | select(.agentId == $id)] | if length > 0 then "queue position \(.[0].position // "?")" else "not in queue" end')
  echo "[waiting] $SLOT_TYPE is $STATUS — you are $QUEUE_POS. Checking again in 10s..." >&2
  sleep 10
done
