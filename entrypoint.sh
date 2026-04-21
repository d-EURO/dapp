#!/bin/sh
set -e

echo "=========="
echo "dEURO dApp"
echo "=========="

# Build sed script for all NEXT_PUBLIC_ env var replacements
SED_SCRIPT=$(mktemp)
printenv | grep '^NEXT_PUBLIC_' | while IFS='=' read -r key value; do
  echo "s|${key}|${value}|g" >> "$SED_SCRIPT"
  echo "Replace: $key"
done

echo "Replacing env vars in .next build output..."
find /app/.next/ -type f \( -name '*.js' -o -name '*.json' -o -name '*.html' \) -exec sed -i -f "$SED_SCRIPT" {} +
rm -f "$SED_SCRIPT"
echo "Done."

# Execute the container's main process (CMD in Dockerfile)
exec "$@"
