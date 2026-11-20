#!/usr/bin/env bash
# Resize full-size stage photographs for the web and strip their metadata.
#
# The photographer's files are 6000px and up to 26 MB, with camera EXIF
# (serial numbers, sometimes location). What ships is a 1600px JPEG in sRGB
# with none of that. Prints "name width height" per file for the content JSON.
#
#   scripts/prepare-photos.sh <slug> <photo.jpg>...
#   MAX=2400 scripts/prepare-photos.sh hero <photo.jpg>
set -euo pipefail

slug="$1"
shift
max="${MAX:-1600}"
out="$(cd "$(dirname "$0")/.." && pwd)/public/assets/photos/$slug"
mkdir -p "$out"

for src in "$@"; do
  name="$(basename "$src" .jpg | tr '[:upper:]_' '[:lower:]-')"
  dest="$out/$name.jpg"
  # 2>/dev/null: the camera's XMP block is malformed and every read warns.
  magick "$src" -auto-orient -colorspace sRGB -resize "${max}x${max}>" \
    -strip -sampling-factor 4:2:0 -interlace JPEG -quality 82 "$dest" 2>/dev/null
  echo "$name $(magick identify -format '%w %h' "$dest")"
done
