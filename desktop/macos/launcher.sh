#!/bin/bash
# Starts the LunchLoop API and the built web app, opens them in their own
# window, and stops both servers when that window closes or the app quits.
# make-app.sh copies this file into LunchLoop.app/Contents/Resources.

HERE="$(cd "$(dirname "$0")" && pwd)"
API_PORT="${LUNCHLOOP_API_PORT:-8765}"
WEB_PORT="${LUNCHLOOP_WEB_PORT:-4765}"
SUPPORT="$HOME/Library/Application Support/LunchLoop"
APP_DIR="$SUPPORT/app"
PY="$SUPPORT/venv/bin/python"
LOG="$HOME/Library/Logs/LunchLoop.log"
PROFILE="$SUPPORT/chrome-profile"
PIDFILE="$SUPPORT/launcher.pid"
API_URL="http://127.0.0.1:$API_PORT"
WEB_URL="http://127.0.0.1:$WEB_PORT"
START_URL="$WEB_URL/"

export PATH="/usr/bin:/bin:/usr/sbin:/sbin"
mkdir -p "$SUPPORT" "$(dirname "$LOG")"
exec >>"$LOG" 2>&1
echo "--- $(date '+%Y-%m-%d %H:%M:%S') LunchLoop starting"

say() { echo "[$(date '+%H:%M:%S')] $*"; }
fail() {
  say "ERROR: $*"
  # Show the alert without blocking, so the servers are still cleaned up.
  osascript -e "display alert \"LunchLoop could not start\" message \"$*  Details are in ~/Library/Logs/LunchLoop.log.\" giving up after 120" >/dev/null 2>&1 &
  exit 1
}
answers() { curl -fsS -m 2 -o /dev/null "$1" 2>/dev/null; }
port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

find_browser() {
  local app
  for app in "Google Chrome" "Chromium" "Brave Browser" "Microsoft Edge"; do
    for dir in /Applications "$HOME/Applications"; do
      if [ -x "$dir/$app.app/Contents/MacOS/$app" ]; then
        echo "$dir/$app.app/Contents/MacOS/$app"
        return 0
      fi
    done
  done
  return 1
}

open_window() {
  if [ -n "$BROWSER" ]; then
    "$BROWSER" --user-data-dir="$PROFILE" --app="$START_URL" \
      --no-first-run --no-default-browser-check >/dev/null 2>&1 &
  else
    open "$START_URL"
  fi
}

profile_in_use() { pgrep -f -- "--user-data-dir=$PROFILE" >/dev/null 2>&1; }

BROWSER="$(find_browser)"

# A second launch just brings the existing window forward.
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  say "already running (pid $(cat "$PIDFILE")), opening a window"
  open_window
  exit 0
fi
echo $$ >"$PIDFILE"

API_PID=""
WEB_PID=""
cleanup() {
  trap - EXIT TERM INT HUP
  say "stopping servers"
  [ -n "$WEB_PID" ] && kill "$WEB_PID" 2>/dev/null
  [ -n "$API_PID" ] && kill "$API_PID" 2>/dev/null
  sleep 0.5
  [ -n "$WEB_PID" ] && kill -9 "$WEB_PID" 2>/dev/null
  [ -n "$API_PID" ] && kill -9 "$API_PID" 2>/dev/null
  # If the app is quit while its window is open, close the window too.
  pkill -f -- "--user-data-dir=$PROFILE" 2>/dev/null
  rm -f "$PIDFILE"
  exit 0
}
trap cleanup EXIT TERM INT HUP

[ -x "$PY" ] && [ -f "$APP_DIR/web/dist/index.html" ] || fail "The app files are missing. Rebuild the app with desktop/macos/make-app.sh."

# API server. Reuse one that is already answering; refuse if something else owns the port.
if answers "$API_URL/api/health"; then
  say "API already answering on $API_PORT, reusing it"
elif port_busy "$API_PORT"; then
  fail "Port $API_PORT is in use by another program."
else
  say "starting API on $API_PORT"
  (
    cd "$APP_DIR" || exit 1
    export LUNCHLOOP_DB="$SUPPORT/lunchloop.db"
    export LUNCHLOOP_DATA_DIR="$APP_DIR/data"
    exec "$PY" -m uvicorn api.main:app --host 127.0.0.1 --port "$API_PORT"
  ) &
  API_PID=$!
fi

# Web server.
if answers "$WEB_URL/"; then
  say "web server already answering on $WEB_PORT, reusing it"
elif port_busy "$WEB_PORT"; then
  fail "Port $WEB_PORT is in use by another program."
else
  say "starting web server on $WEB_PORT"
  "$PY" "$HERE/serve.py" "$APP_DIR/web/dist" "$WEB_PORT" "$API_URL" &
  WEB_PID=$!
fi

# The first launch can be slow while Python loads its packages for the first time.
for _ in $(seq 1 240); do
  answers "$API_URL/api/health" && answers "$WEB_URL/" && break
  [ -n "$API_PID" ] && ! kill -0 "$API_PID" 2>/dev/null && fail "The API server stopped during startup."
  [ -n "$WEB_PID" ] && ! kill -0 "$WEB_PID" 2>/dev/null && fail "The web server stopped during startup."
  sleep 0.5
done
answers "$API_URL/api/health" && answers "$WEB_URL/" || fail "The servers did not start in time."
say "servers ready"

if [ -z "$BROWSER" ]; then
  say "no Chromium browser found, using the default browser"
  open_window
  # Without our own window there is nothing to watch, so keep serving until the app is quit.
  while true; do sleep 3600 & wait $!; done
fi

say "opening window with $BROWSER"
open_window
# Give the window time to appear, then wait for it to close.
for _ in $(seq 1 30); do profile_in_use && break; sleep 0.5; done
while profile_in_use; do sleep 1; done
say "window closed"
