#!/usr/bin/env bash
# Turn raw stage photos into ink-posterized comic panels.
# Amateur phone capture reads as deliberate once it is reduced to two inks.
set -euo pipefail

SRC="${1:-$HOME/Downloads/parchant}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/prototype/assets/panels"
mkdir -p "$OUT"

INK='#241A12'
PAPER='#F2E3B8'
RED='#C4241E'
GREEN='#2E6B3A'

# ink <source> <output> <light-ink> <dark-ink> <crop-and-resize-args...>
ink() {
  local src="$1" out="$2" lo="$3" hi="$4"
  shift 4
  magick "$src" -auto-orient "$@" \
    -colorspace Gray -normalize -level 8%,92% \
    -brightness-contrast 0x38 -posterize 3 \
    +level-colors "$lo","$hi" \
    -colors 4 -strip "PNG8:$out"
}

ink "$SRC/WhatsApp Image 2026-08-04 at 12.11.08 (4).jpeg" "$OUT/hero.png" "$INK" "$PAPER" \
  -gravity north -crop 1560x900+0+180 +repage -resize 1400x

ink "$SRC/WhatsApp Image 2026-08-04 at 12.11.07.jpeg" "$OUT/sipy-1.png" "$INK" "$PAPER" \
  -gravity north -crop 1200x1150+0+120 +repage -resize 900x

ink "$SRC/WhatsApp Image 2026-08-04 at 12.11.08 (1).jpeg" "$OUT/sipy-2.png" "$INK" "$PAPER" \
  -gravity north -crop 1200x1150+0+150 +repage -resize 900x

ink "$SRC/WhatsApp Image 2026-08-04 at 12.11.08.jpeg" "$OUT/sipy-dark.png" "$INK" "$RED" \
  -gravity center -crop 1200x900+0+0 +repage -resize 900x

ink "$SRC/WhatsApp Image 2026-08-04 at 12.11.08 (2).jpeg" "$OUT/ensemble.png" "$INK" "$PAPER" \
  -gravity north -crop 1536x850+0+120 +repage -resize 1100x

ink "$SRC/WhatsApp Image 2026-08-04 at 12.11.08 (3).jpeg" "$OUT/sipy-3.png" "$INK" "$PAPER" \
  -gravity north -crop 1200x1000+0+200 +repage -resize 900x

ink "$SRC/WhatsApp Image 2026-08-04 at 12.11.07 (1).jpeg" "$OUT/scene.png" "$INK" "$GREEN" \
  -gravity north -crop 1200x900+0+150 +repage -resize 900x

ink "$SRC/WhatsApp Image 2026-08-04 at 12.11.08 (9).jpeg" "$OUT/hra.png" "$INK" "$PAPER" \
  -gravity north -crop 1600x1000+0+120 +repage -resize 1000x

ink "$SRC/WhatsApp Image 2026-08-04 at 12.11.08 (8).jpeg" "$OUT/cardboard.png" "$INK" "$GREEN" \
  -gravity center -crop 1400x1150+0+0 +repage -resize 900x

# The poster is already artwork. Keep its own colours, only downscale.
magick "$SRC/WhatsApp Image 2026-08-04 at 12.11.08 (7).jpeg" \
  -auto-orient -resize 820x -quality 82 -strip "$OUT/poster.jpg"

echo "Panels written to $OUT"
ls -la "$OUT" | awk 'NR>3 {printf "%8d  %s\n", $5, $9}'
