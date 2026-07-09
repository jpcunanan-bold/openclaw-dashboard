#!/bin/bash
# Dead-simple cost reporter for Laura
# Usage: laura-report.sh <taskId> <taskName> <model> <inputTokens> <outputTokens> <cacheReadTokens> <cacheWriteTokens> [timeSavedMin]
#
# Laura calls this after EVERY response with token data from session_status

API="http://127.0.0.1:3100/api/tasks/cost"

curl -sf -X POST "$API" \
  -H "Content-Type: application/json" \
  -d "{
    \"taskId\": \"$1\",
    \"taskName\": \"$2\",
    \"model\": \"$3\",
    \"inputTokens\": ${4:-0},
    \"outputTokens\": ${5:-0},
    \"cacheReadTokens\": ${6:-0},
    \"cacheWriteTokens\": ${7:-0},
    \"timeSavedMin\": ${8:-0}
  }" > /dev/null 2>&1
