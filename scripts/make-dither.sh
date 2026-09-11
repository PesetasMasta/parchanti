#!/usr/bin/env bash
# Build one seam tile: a dot matrix that thins out along its height.
#
#   scripts/make-dither.sh <height-px> <up|down> <out.png> [cell-px]
#
# The seams are not gradients. Every cell is either full ink or nothing and
# what changes down the tile is how many are lit, so there is no intermediate
# tone anywhere in one to go soft when it is scaled or blended.
#
# Three things decide whether it reads as a printed matrix or as noise:
#
#   Cell size. 1px by default, and the one knob worth turning: it is what
#   decides whether the seam reads as a coarse printed matrix or a fine one.
#   It was 3px until 2026-09-11, when the client asked twice for the pixels
#   softened while keeping the effect - it is meant to read as a theatre
#   spotlight, so dissolving it into a smooth gradient would have thrown away
#   the point. 3px went to 2px, then to 1px, which is the floor: the mask is
#   laid at a fixed 1536px so one image pixel is one CSS pixel, and a cell
#   cannot go below that without the browser resampling it into grey. The tile
#   is built at cell resolution and scaled up with point sampling, so a cell is
#   a hard square and never a blurred dot, whatever the size.
#
#   Threshold distribution. The lit/unlit decision compares a vertical ramp
#   against a threshold map, so the map's histogram IS the density curve. A
#   single channel of Random is taken rather than an average of three, because
#   averaging channels gives a triangular distribution and compresses both
#   ends of the ramp.
#
#   Threshold character. White noise is aperiodic but clumps; an ordered
#   matrix is even but repeats every 8 cells and the repeat is visible. This
#   high-passes the noise and equalises it, which is blue noise: aperiodic and
#   evenly spread at once.
#
# Both shipped tiles ARE reproduced by this script as of 2026-09-11: they used
# to predate it and differ from each other by more than their direction, which
# is why the foot of the page and the head of it never quite matched. They are
# now one method, one cell size, one run apart.
set -euo pipefail

HEIGHT="${1:?height in px}"
DIRECTION="${2:?up|down}"
OUT="${3:?output png}"
CELL="${4:-1}"

WIDTH=1536
(( HEIGHT % CELL == 0 )) || { echo "height must be a multiple of $CELL" >&2; exit 1; }
(( WIDTH % CELL == 0 )) || { echo "width $WIDTH must be a multiple of $CELL" >&2; exit 1; }
CW=$(( WIDTH / CELL ))
CH=$(( HEIGHT / CELL ))

# "down" is dense at the top and thins downward - the hero band dissolving into
# the page. "up" is the mirror, for a band that sits below its seam.
case "$DIRECTION" in
  down) RAMP="gradient:white-black" ;;
  up)   RAMP="gradient:black-white" ;;
  *) echo "direction must be up or down" >&2; exit 1 ;;
esac

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

magick -size "${CW}x${CH}" xc: +noise Random -channel R -separate \
  \( +clone -blur 0x2 \) -compose Mathematics -define compose:args='0,1,-1,0.5' -composite \
  -equalize "$WORK/threshold.png"

magick -size "${CW}x${CH}" "$RAMP" "$WORK/ramp.png"

# u is the ramp, v the threshold: light the cell where the ramp has got ahead.
magick "$WORK/ramp.png" "$WORK/threshold.png" -fx "u>v ? 1 : 0" "$WORK/cells.png"

# Point-sampled up to full size, then the black-and-white result becomes the
# alpha of a black tile - CSS mask-image reads alpha, not luminance.
magick "$WORK/cells.png" -filter point -resize "${WIDTH}x${HEIGHT}!" \
  -alpha copy -channel RGB -evaluate set 0 +channel \
  -define png:color-type=4 "$OUT"

echo "$OUT"
magick identify -format '  %wx%h %[channels]\n' "$OUT"
for band in 0 25 50 75 100; do
  y=$(( (HEIGHT - HEIGHT / 8) * band / 100 ))
  printf '  %3s%% down: ' "$band"
  magick "$OUT" -crop "${WIDTH}x$((HEIGHT / 8))+0+${y}" +repage -alpha extract \
    -format 'lit %.0f%%\n' -format '%[fx:mean*100]%% lit\n' info:
done
