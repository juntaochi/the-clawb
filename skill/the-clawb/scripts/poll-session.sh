#!/usr/bin/env bash
set -euo pipefail

CRED_FILE="$HOME/.config/the-clawb/credentials.json"
API_KEY=$(jq -r .apiKey "$CRED_FILE")
SERVER="${THE_CLAWB_SERVER:-https://server.theclawb.dev}"

RESPONSE=$(curl -sf "$SERVER/api/v1/sessions/current" \
  -H "Authorization: Bearer $API_KEY")

echo "$RESPONSE" | jq .

STATUS=$(curl -sf "$SERVER/api/v1/slots/status")
echo ""
echo "Slot status:"
echo "$STATUS" | jq '{dj: {status: .dj.status, agent: .dj.agent}, vj: {status: .vj.status, agent: .vj.agent}, queueLength: (.queue | length)}'
