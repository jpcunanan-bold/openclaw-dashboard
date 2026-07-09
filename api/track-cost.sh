#!/bin/bash
# Automatic cost tracking for Laura sessions
# Usage:
#   track-cost.sh snapshot              — Save current token counts as baseline
#   track-cost.sh report <taskId> [taskName] [timeSavedMin]  — Calculate delta from snapshot and POST
#   track-cost.sh auto <taskId> [taskName] [timeSavedMin]    — One-shot: use session_status, POST full session cost
#
# Reads session_status from OpenClaw CLI or from stdin

STATE_DIR="/var/www/laura-dashboard/api-server/data"
SNAPSHOT_FILE="$STATE_DIR/token-snapshot.json"
API_URL="http://127.0.0.1:3100/api/tasks/cost"

mkdir -p "$STATE_DIR"

get_session_stats() {
  # Call openclaw to get session status, or parse from environment
  # We'll use a simple curl to the OpenClaw gateway for session info
  # Fallback: parse from session_status output passed via pipe
  local stats
  stats=$(openclaw status --json 2>/dev/null || echo '{}')
  echo "$stats"
}

parse_tokens_from_status() {
  # Parse token info from openclaw status output (text format)
  # Expected format from session_status:
  # 🧮 Tokens: 24 in / 19k out
  # 🗄️ Cache: 99% hit · 86k cached, 614 new
  local input="$1"
  
  local tokens_in=$(echo "$input" | grep -oP 'Tokens:\s*\K[\d.]+[kKmM]?' | head -1)
  local tokens_out=$(echo "$input" | grep -oP '/\s*\K[\d.]+[kKmM]?\s*out' | grep -oP '[\d.]+[kKmM]?' | head -1)
  local cache_read=$(echo "$input" | grep -oP '[\d.]+[kKmM]?\s*cached' | grep -oP '[\d.]+[kKmM]?' | head -1)
  local cache_new=$(echo "$input" | grep -oP '[\d,.]+\s*new' | grep -oP '[\d,.]+' | head -1)
  local model=$(echo "$input" | grep -oP 'Model:\s*\K[^\s·]+' | head -1)
  
  # Convert k/m suffixes to numbers
  convert_num() {
    local val="$1"
    if [[ "$val" =~ [kK]$ ]]; then
      val=$(echo "$val" | sed 's/[kK]$//' | awk '{printf "%d", $1 * 1000}')
    elif [[ "$val" =~ [mM]$ ]]; then
      val=$(echo "$val" | sed 's/[mM]$//' | awk '{printf "%d", $1 * 1000000}')
    fi
    echo "${val:-0}"
  }
  
  tokens_in=$(convert_num "$tokens_in")
  tokens_out=$(convert_num "$tokens_out")
  cache_read=$(convert_num "$cache_read")
  cache_new=$(convert_num "$cache_new")
  
  echo "{\"inputTokens\":$tokens_in,\"outputTokens\":$tokens_out,\"cacheReadTokens\":$cache_read,\"cacheWriteTokens\":$cache_new,\"model\":\"$model\"}"
}

case "$1" in
  snapshot)
    # Save current token state as baseline
    if [ -t 0 ]; then
      echo "Pipe session_status output to this command"
      echo "Example: echo 'session_status_output' | track-cost.sh snapshot"
      exit 1
    fi
    input=$(cat)
    stats=$(parse_tokens_from_status "$input")
    echo "$stats" > "$SNAPSHOT_FILE"
    echo "Snapshot saved: $stats"
    ;;
    
  report)
    TASK_ID="$2"
    TASK_NAME="${3:-Laura activity}"
    TIME_SAVED="${4:-0}"
    
    if [ -z "$TASK_ID" ]; then
      echo "Usage: track-cost.sh report <taskId> [taskName] [timeSavedMin]"
      exit 1
    fi
    
    if [ ! -f "$SNAPSHOT_FILE" ]; then
      echo "No snapshot found. Run 'track-cost.sh snapshot' first."
      exit 1
    fi
    
    if [ -t 0 ]; then
      echo "Pipe current session_status output to calculate delta"
      exit 1
    fi
    
    input=$(cat)
    current=$(parse_tokens_from_status "$input")
    baseline=$(cat "$SNAPSHOT_FILE")
    
    # Calculate deltas using python for json parsing
    delta=$(python3 -c "
import json, sys
cur = json.loads('$current')
base = json.loads('$baseline')
d = {
  'taskId': '$TASK_ID',
  'taskName': '$TASK_NAME',
  'model': cur.get('model', 'unknown'),
  'inputTokens': max(0, cur['inputTokens'] - base['inputTokens']),
  'outputTokens': max(0, cur['outputTokens'] - base['outputTokens']),
  'cacheReadTokens': max(0, cur['cacheReadTokens'] - base['cacheReadTokens']),
  'cacheWriteTokens': max(0, cur['cacheWriteTokens'] - base['cacheWriteTokens']),
  'timeSavedMin': int('$TIME_SAVED')
}
d['totalTokens'] = d['inputTokens'] + d['outputTokens'] + d['cacheReadTokens'] + d['cacheWriteTokens']
print(json.dumps(d))
")
    
    curl -s -X POST "$API_URL" -H "Content-Type: application/json" -d "$delta"
    echo ""
    # Clear snapshot
    rm -f "$SNAPSHOT_FILE"
    ;;
    
  auto)
    # One-shot: just POST the provided token data directly
    TASK_ID="$2"
    TASK_NAME="${3:-Laura activity}"
    TIME_SAVED="${4:-0}"
    INPUT_TOKENS="${5:-0}"
    OUTPUT_TOKENS="${6:-0}"
    CACHE_READ="${7:-0}"
    CACHE_WRITE="${8:-0}"
    MODEL="${9:-unknown}"
    
    if [ -z "$TASK_ID" ]; then
      echo "Usage: track-cost.sh auto <taskId> [taskName] [timeSavedMin] [inputTokens] [outputTokens] [cacheRead] [cacheWrite] [model]"
      exit 1
    fi
    
    curl -s -X POST "$API_URL" -H "Content-Type: application/json" -d "{
      \"taskId\": \"$TASK_ID\",
      \"taskName\": \"$TASK_NAME\",
      \"model\": \"$MODEL\",
      \"inputTokens\": $INPUT_TOKENS,
      \"outputTokens\": $OUTPUT_TOKENS,
      \"cacheReadTokens\": $CACHE_READ,
      \"cacheWriteTokens\": $CACHE_WRITE,
      \"timeSavedMin\": $TIME_SAVED
    }"
    echo ""
    ;;
    
  *)
    echo "Usage: track-cost.sh {snapshot|report|auto} [args...]"
    exit 1
    ;;
esac
