#!/usr/bin/env bash
# send-logs-to-loki.sh
# Generates 1000 log entries with timestamps from the last 24 hours
# and sends them to Loki in batches via the push API.
# Logs are sent with various levels (info, warn, error) and realistic messages.

set -e

LOKI_URL="${LOKI_URL:-http://localhost:3100/loki/api/v1/push}"
BATCH_SIZE=50
TOTAL_LOGS=1000
NUM_BATCHES=$((TOTAL_LOGS / BATCH_SIZE))

RESET='\033[0m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'

echo -e "${YELLOW}=== Loki Log Generator ===${RESET}"
echo -e "Target: ${CYAN}${LOKI_URL}${RESET}"
echo -e "Total logs: ${CYAN}${TOTAL_LOGS}${RESET}"
echo -e "Batch size: ${CYAN}${BATCH_SIZE}${RESET}"
echo -e "Batches: ${CYAN}${NUM_BATCHES}${RESET}"
echo ""

# Log levels and messages for variety
LOG_LEVELS=("info" "warn" "error")
LOG_MESSAGES=(
  "User authentication successful"
  "Database connection established"
  "Cache miss for key: user:123"
  "API request timeout after 30s"
  "Configuration reloaded from disk"
  "Memory usage at 75%"
  "Background job queued: data-sync"
  "Request validation failed: invalid email"
  "Worker process crashed, restarting"
  "Deprecated API endpoint called"
  "Rate limit exceeded for IP: 192.168.1.1"
  "TLS certificate will expire in 30 days"
  "Database query slow (2.5s): SELECT * FROM users"
  "Service dependency unavailable: payment-service"
  "Health check passed"
  "Failed login attempt (3 retries)"
  "Data export completed: 10,000 records"
  "Async task processed: send-email"
  "Connection pool exhausted, waiting..."
  "Security: SQL injection attempt detected"
)

# Function to generate random timestamp within last 24 hours (in nanoseconds)
random_timestamp_ns() {
  local now_ns=$(date +%s%N)
  local day_ago_ns=$((now_ns - 86400000000000))  # 24 hours in nanoseconds
  local random_offset=$((RANDOM % 86400000000000))  # Random offset within 24 hours
  local random_ns=$((day_ago_ns + random_offset))
  echo "$random_ns"
}

# Function to pick random element from array
pick_random() {
  local arr=("$@")
  echo "${arr[RANDOM % ${#arr[@]}]}"
}

# Build a batch of log entries
build_batch() {
  local batch_num=$1
  local start_idx=$((batch_num * BATCH_SIZE))
  local end_idx=$(((batch_num + 1) * BATCH_SIZE))

  # Base timestamp increases sequentially across batches
  # Start from 1 hour ago and increment for each batch (Loki's ingestion window is ~12h, but let's be safe)
  local now_ns=$(date +%s%N)
  local hour_ago_ns=$((now_ns - 3600000000000))
  local base_ts=$((hour_ago_ns + batch_num * BATCH_SIZE * 1000000))

  # Start JSON structure
  echo -n '{"streams":[{"stream":{"job":"test-generator","batch":"'$batch_num'"},"values":['

  local first=true
  for ((i = start_idx; i < end_idx; i++)); do
    # Ensure monotonically increasing timestamps across all logs
    local offset=$((i))  # Global log number, not per-batch
    local ts=$((hour_ago_ns + offset * 1000000))  # Each log is 1ms after the previous globally
    local level=$(pick_random "${LOG_LEVELS[@]}")
    local msg=$(pick_random "${LOG_MESSAGES[@]}")

    if [ "$first" = false ]; then
      echo -n ","
    fi
    first=false

    # Escape message for JSON
    local msg_escaped=$(echo "$msg" | sed 's/"/\\"/g')
    echo -n '["'$ts'","['$level'] '$msg_escaped'"]'
  done

  # Close JSON structure
  echo -n ']}'
  echo -n ']}'
}

# Send batch to Loki
send_batch() {
  local batch_num=$1
  local json_payload=$2

  local http_code
  local response

  response=$(curl -s -w "\n%{http_code}" -X POST "$LOKI_URL" \
    -H "Content-Type: application/json" \
    -d "$json_payload" 2>&1)

  http_code=$(echo "$response" | tail -n1)

  if [[ "$http_code" == "204" ]]; then
    echo -e "${GREEN}✓${RESET} Batch $((batch_num + 1))/$NUM_BATCHES sent (HTTP 204)"
  else
    echo -e "${RED}✗${RESET} Batch $((batch_num + 1))/$NUM_BATCHES failed (HTTP $http_code)"
    return 1
  fi
}

# Main loop
echo -e "${YELLOW}Sending logs in batches...${RESET}\n"

failed_batches=0
for ((batch = 0; batch < NUM_BATCHES; batch++)); do
  payload=$(build_batch $batch)
  send_batch $batch "$payload" || ((failed_batches++))
done

echo ""
echo -e "${YELLOW}=== Summary ===${RESET}"
echo -e "Total batches: ${CYAN}${NUM_BATCHES}${RESET}"
echo -e "Successful: ${GREEN}$((NUM_BATCHES - failed_batches))${RESET}"
echo -e "Failed: $([ $failed_batches -eq 0 ] && echo -e "${GREEN}0${RESET}" || echo -e "${RED}${failed_batches}${RESET}")"
echo -e "Total logs sent: ${CYAN}$((TOTAL_LOGS - failed_batches * BATCH_SIZE))${RESET}"
echo ""
echo -e "${YELLOW}Verify in Loki:${RESET}"
echo -e "  ${CYAN}curl http://localhost:3100/loki/api/v1/query?query={job=\"test-generator\"}${RESET}"
