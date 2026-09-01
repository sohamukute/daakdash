#!/usr/bin/env bash
# Encode a rendered PNG sequence (blender/daakdash_world.py --mode anim) into the hero film:
# forward + reversed cuts at 1080p and 720p, and a poster.
#   blender/encode_film.sh /tmp/dd/frames
set -euo pipefail
FR=$(realpath "${1:?usage: encode_film.sh <frames dir>}")
P="$(cd "$(dirname "$0")/.." && pwd)/frontend/public"
cd "$FR"
ls *.png | sort -r | sed "s|^|file '$FR/|; s|$|'\nduration 0.041666667|" > reverse.txt
X264=(-c:v libx264 -preset slow -g 12 -keyint_min 12 -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart -an)
ffmpeg -v error -y -framerate 24 -start_number 0 -i %04d.png "${X264[@]}" -crf 23 "$P/media/daakdash-world-1080.mp4"
ffmpeg -v error -y -framerate 24 -start_number 0 -i %04d.png -vf scale=1280:-2 "${X264[@]}" -crf 25 "$P/media/daakdash-world-720.mp4"
ffmpeg -v error -y -f concat -safe 0 -i reverse.txt -r 24 "${X264[@]}" -crf 23 "$P/media/daakdash-world-1080-reverse.mp4"
ffmpeg -v error -y -f concat -safe 0 -i reverse.txt -r 24 -vf scale=1280:-2 "${X264[@]}" -crf 25 "$P/media/daakdash-world-720-reverse.mp4"
ffmpeg -v error -y -i 0000.png -c:v libwebp -quality 80 "$P/media/daakdash-world-poster.webp"
rm reverse.txt
ls -la "$P/media"
