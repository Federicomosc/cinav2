#!/usr/bin/env bash
set -eo pipefail

# Genera public/tiles/cina.pmtiles — basemap offline (Protomaps, WGS-84).
# Strategia: overview z0-9 (unione) + 5 città z10-15 (merge senza sovrapposizioni).
#
# Uso: npm run tiles

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/public/tiles"
TOOLS_DIR="$ROOT/tools"
PMTILES_BIN="$TOOLS_DIR/pmtiles"
OUT="$OUT_DIR/cina.pmtiles"

PLANET_URL="${PLANET_URL:-https://build.protomaps.com/20260628.pmtiles}"
MAX_ZOOM="${MAX_ZOOM:-15}"
CITY_MIN_ZOOM="${CITY_MIN_ZOOM:-10}"
OVERVIEW_MAX_ZOOM="${OVERVIEW_MAX_ZOOM:-9}"
DOWNLOAD_THREADS="${DOWNLOAD_THREADS:-6}"

OVERVIEW_BBOX="103.85,29.00,121.60,40.50"

CITIES=(chengdu chongqing zhangjiajie pechino shanghai)
BBOXES=(
  "103.85,30.55,104.25,30.80"
  "106.40,29.45,106.65,29.65"
  "110.35,29.00,110.60,29.45"
  "116.05,39.80,116.65,40.50"
  "121.30,31.10,121.60,31.30"
)

mkdir -p "$OUT_DIR" "$TOOLS_DIR"

install_cli() {
  if [[ -x "$PMTILES_BIN" ]]; then return; fi
  echo "→ Scarico pmtiles CLI…"
  local arch url zip
  arch="$(uname -m)"
  case "$arch" in
    arm64) url="https://github.com/protomaps/go-pmtiles/releases/download/v1.30.3/go-pmtiles-1.30.3_Darwin_arm64.zip" ;;
    x86_64) url="https://github.com/protomaps/go-pmtiles/releases/download/v1.30.3/go-pmtiles-1.30.3_Darwin_x86_64.zip" ;;
    *) echo "Architettura non supportata: $arch"; exit 1 ;;
  esac
  zip="$TOOLS_DIR/pmtiles-cli.zip"
  curl -fsSL -o "$zip" "$url"
  unzip -o -j "$zip" pmtiles -d "$TOOLS_DIR"
  chmod +x "$PMTILES_BIN"
  rm -f "$zip"
}

install_cli
echo "✓ pmtiles CLI"

if [[ -f "$OUT" ]]; then
  echo "⊙ $OUT già presente ($(du -h "$OUT" | cut -f1)) — eliminalo per rigenerare"
  exit 0
fi

PARTS=()
overview="$OUT_DIR/_part_overview.pmtiles"
if [[ ! -f "$overview" ]]; then
  echo "↓ overview z0-${OVERVIEW_MAX_ZOOM}…"
  "$PMTILES_BIN" extract "$PLANET_URL" "$overview" \
    --bbox="$OVERVIEW_BBOX" --maxzoom="$OVERVIEW_MAX_ZOOM" \
    --download-threads="$DOWNLOAD_THREADS"
fi
PARTS+=("$overview")

for i in "${!CITIES[@]}"; do
  city="${CITIES[$i]}"
  bbox="${BBOXES[$i]}"
  part="$OUT_DIR/_part_${city}.pmtiles"
  if [[ ! -f "$part" ]]; then
    echo "↓ $city z${CITY_MIN_ZOOM}-${MAX_ZOOM}…"
    "$PMTILES_BIN" extract "$PLANET_URL" "$part" \
      --bbox="$bbox" --minzoom="$CITY_MIN_ZOOM" --maxzoom="$MAX_ZOOM" \
      --download-threads="$DOWNLOAD_THREADS"
  else
    echo "⊙ $city già presente"
  fi
  PARTS+=("$part")
done

echo "→ merge → $OUT"
"$PMTILES_BIN" merge "${PARTS[@]}" "$OUT"
echo "✅ cina.pmtiles ($(du -h "$OUT" | cut -f1))"
