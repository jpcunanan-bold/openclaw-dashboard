#!/bin/bash
# Usage: report-cost.sh <taskId> <taskName> <model> <inputTokens> <outputTokens> <cacheReadTokens> <cacheWriteTokens> [timeSavedMin]
# Example: report-cost.sh T-0147 "Email Brent re pricing" "claude-opus-4-6" 25000 1500 80000 5000 10

TASK_ID="$1"
TASK_NAME="$2"
MODEL="$3"
INPUT_TOKENS="${4:-0}"
OUTPUT_TOKENS="${5:-0}"
CACHE_READ="${6:-0}"
CACHE_WRITE="${7:-0}"
TIME_SAVED="${8:-0}"

if [ -z "$TASK_ID" ]; then
  echo "Usage: report-cost.sh <taskId> <taskName> <model> <inputTokens> <outputTokens> <cacheReadTokens> <cacheWriteTokens> [timeSavedMin]"
  exit 1
fi

curl -s -X POST http://127.0.0.1:3100/api/tasks/cost \
  -H "Content-Type: application/json" \
  -d "{
    \"taskId\": \"$TASK_ID\",
    \"taskName\": \"$TASK_NAME\",
    \"model\": \"$MODEL\",
    \"inputTokens\": $INPUT_TOKENS,
    \"outputTokens\": $OUTPUT_TOKENS,
    \"cacheReadTokens\": $CACHE_READ,
    \"cacheWriteTokens\": $CACHE_WRITE,
    \"timeSavedMin\": $TIME_SAVED
  }"
