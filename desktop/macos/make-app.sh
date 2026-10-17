#!/bin/bash
# Builds LunchLoop.app and installs it to /Applications.
#
#   desktop/macos/make-app.sh [--icon FILE] [--dest DIR] [--dist DIR] [--skip-build]
#
#   --icon FILE    icon source, .svg or .png (default: desktop/macos/AppIcon.svg)
#   --dest DIR     where to put LunchLoop.app (default: /Applications)
#   --dist DIR     use an existing web build instead of running "npm run build"
#   --skip-build   reuse the current web/dist without rebuilding
#
# The app runs a copy of the code made at build time (kept in
# ~/Library/Application Support/LunchLoop/app, along with the database), so
# rebuild it after pulling changes. The copy also keeps the app out of
# protected folders like Desktop and Documents, which macOS asks about.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$HERE/../.." && pwd)"
SUPPORT="$HOME/Library/Application Support/LunchLoop"
ICON="$HERE/AppIcon.svg"
DEST="/Applications"
DIST_DIR="$REPO_DIR/web/dist"
BUILD_WEB=1
MARKER="org.lunchloop.app"

while [ $# -gt 0 ]; do
  case "$1" in
    --icon) ICON="$2"; shift 2 ;;
    --dest) DEST="$2"; shift 2 ;;
    --dist) DIST_DIR="$2"; BUILD_WEB=0; shift 2 ;;
    --skip-build) BUILD_WEB=0; shift ;;
    -h|--help) sed -n 2,12p "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

[ "$(uname)" = "Darwin" ] || { echo "This script only works on macOS." >&2; exit 1; }
[ -f "$ICON" ] || { echo "Icon not found: $ICON" >&2; exit 1; }

APP="$DEST/LunchLoop.app"
if [ -e "$APP" ]; then
  existing="$(/usr/libexec/PlistBuddy -c 'Print :LunchLoopBuiltBy' "$APP/Contents/Info.plist" 2>/dev/null || true)"
  if [ "$existing" != "make-app.sh" ]; then
    echo "$APP exists and was not made by this script. Move it away and run again." >&2
    exit 1
  fi
fi

# --- tools -----------------------------------------------------------------
NPM="$(command -v npm || true)"

PY=""
for candidate in python3.14 python3.13 python3.12 python3; do
  p="$(command -v "$candidate" || true)"
  [ -n "$p" ] || continue
  if "$p" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 12) else 1)' 2>/dev/null; then PY="$p"; break; fi
done
[ -n "$PY" ] || { echo "Python 3.12 or newer is required (brew install python@3.12)." >&2; exit 1; }

# --- web build -------------------------------------------------------------
if [ "$BUILD_WEB" = 1 ]; then
  [ -n "$NPM" ] || { echo "npm is required." >&2; exit 1; }
  echo "Building the web app"
  (
    cd "$REPO_DIR/web"
    [ -d node_modules ] || npm ci
    npm run build
  )
fi
[ -f "$DIST_DIR/index.html" ] || { echo "No web build at $DIST_DIR" >&2; exit 1; }

# --- python environment ------------------------------------------------------
mkdir -p "$SUPPORT"
if [ ! -x "$SUPPORT/venv/bin/python" ]; then
  echo "Creating the Python environment"
  "$PY" -m venv "$SUPPORT/venv"
fi
echo "Installing Python packages"
"$SUPPORT/venv/bin/pip" install --quiet --upgrade pip
"$SUPPORT/venv/bin/pip" install --quiet -r "$REPO_DIR/requirements.txt"

# --- code copy -----------------------------------------------------------------
echo "Copying the app code"
rm -rf "$SUPPORT/app"
mkdir -p "$SUPPORT/app/web"
cp -R "$REPO_DIR/api" "$REPO_DIR/engine" "$REPO_DIR/data" "$SUPPORT/app/"
cp -R "$DIST_DIR" "$SUPPORT/app/web/dist"
find "$SUPPORT/app" -name __pycache__ -type d -prune -exec rm -rf {} +

# --- icon --------------------------------------------------------------------
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
echo "Building the icon"
case "$ICON" in
  *.svg|*.SVG)
    # Chrome keeps the transparent corners; Quick Look is the fallback (white corners).
    MASTER="$WORK/master.png"
    CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if [ -x "$CHROME" ]; then
      "$CHROME" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 \
        --window-size=1024,1024 --screenshot="$MASTER" "file://$ICON" >/dev/null 2>&1 || true
    fi
    if [ ! -s "$MASTER" ]; then
      qlmanage -t -s 1024 -o "$WORK" "$ICON" >/dev/null 2>&1 || true
      mv "$WORK/$(basename "$ICON").png" "$MASTER" 2>/dev/null || true
    fi
    [ -s "$MASTER" ] || { echo "Could not render $ICON" >&2; exit 1; }
    ;;
  *) MASTER="$ICON" ;;
esac
ICONSET="$WORK/AppIcon.iconset"
mkdir "$ICONSET"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$MASTER" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  sips -z "$((size * 2))" "$((size * 2))" "$MASTER" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$WORK/AppIcon.icns"

# --- bundle ------------------------------------------------------------------
STAGE="$WORK/LunchLoop.app"
mkdir -p "$STAGE/Contents/MacOS" "$STAGE/Contents/Resources"
cp "$WORK/AppIcon.icns" "$STAGE/Contents/Resources/AppIcon.icns"
cp "$HERE/launcher.sh" "$HERE/serve.py" "$STAGE/Contents/Resources/"
chmod +x "$STAGE/Contents/Resources/launcher.sh"
cat >"$STAGE/Contents/MacOS/LunchLoop" <<'RUN'
#!/bin/bash
exec /bin/bash "$(cd "$(dirname "$0")/../Resources" && pwd)/launcher.sh"
RUN
chmod +x "$STAGE/Contents/MacOS/LunchLoop"
cat >"$STAGE/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>LunchLoop</string>
  <key>CFBundleDisplayName</key><string>LunchLoop</string>
  <key>CFBundleIdentifier</key><string>$MARKER</string>
  <key>CFBundleExecutable</key><string>LunchLoop</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>LunchLoopBuiltBy</key><string>make-app.sh</string>
</dict>
</plist>
PLIST

# --- install -----------------------------------------------------------------
mkdir -p "$DEST"
rm -rf "$APP"
cp -R "$STAGE" "$APP"
touch "$APP"
codesign --force --sign - "$APP" >/dev/null 2>&1 || true
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP" >/dev/null 2>&1 || true
echo "Installed $APP"
