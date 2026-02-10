#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:${PORT:-3310}}"
PUBLIC_URL="${PUBLIC_URL:-https://api.wheatandstone.ca}"
RUN_PUBLIC_SMOKE="${RUN_PUBLIC_SMOKE:-1}"
tmp_file="$(mktemp)"

cleanup() {
  rm -f "$tmp_file"
}
trap cleanup EXIT

check_endpoint() {
  local label="$1"
  local url="$2"
  local expected_code="$3"
  local expected_text="${4:-}"

  local status
  status="$(curl -sS -o "$tmp_file" -w "%{http_code}" "$url")"

  if [[ "$status" != "$expected_code" ]]; then
    echo "[smoke][FAIL] ${label}: expected ${expected_code}, got ${status} (${url})"
    cat "$tmp_file"
    exit 1
  fi

  if [[ -n "$expected_text" ]] && ! grep -q "$expected_text" "$tmp_file"; then
    echo "[smoke][FAIL] ${label}: response missing expected text '${expected_text}' (${url})"
    cat "$tmp_file"
    exit 1
  fi

  echo "[smoke][PASS] ${label}: ${url}"
}

echo "[smoke] ws-api base: ${BASE_URL}"
check_endpoint "local health" "${BASE_URL}/health" "200" "\"status\":\"ok\""
check_endpoint "local ready" "${BASE_URL}/ready" "200" "\"status\":\"ready\""
check_endpoint "local contract" "${BASE_URL}/api/contract" "200" "\"routes\""

if [[ "${RUN_PUBLIC_SMOKE}" == "1" ]]; then
  echo "[smoke] ws-api public: ${PUBLIC_URL}"
  check_endpoint "public health" "${PUBLIC_URL}/health" "200" "\"status\":\"ok\""
  check_endpoint "public ready" "${PUBLIC_URL}/ready" "200" "\"status\":\"ready\""
fi

echo "[smoke] ws-api smoke passed."
