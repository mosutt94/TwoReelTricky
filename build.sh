#!/bin/sh
# Bundles the game into one self-contained index.html, so a phone's cache can never
# serve a mix of old and new files after an update. Run this before every commit.
set -e
cd "$(dirname "$0")"
{
  sed '/<!-- SCRIPTS -->/,$d' src/page.html
  echo '<script>'
  # A print number shown on the title card, so it's easy to tell which version a phone has loaded.
  echo "window.TRT_PRINT = '$(( $(git rev-list --count HEAD 2>/dev/null || echo 0) + 1 ))';"
  for f in core audio hero world skate hud chase flow; do cat "src/$f.js"; echo; done
  echo '</script>'
  sed '1,/<!-- SCRIPTS -->/d' src/page.html
} > index.html
echo "Built index.html ($(wc -c < index.html) bytes)"
