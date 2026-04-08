#!/bin/sh
set -e

echo "=========="
echo "dEURO dApp"
echo "=========="

# Build a single sed expression for all NEXT_PUBLIC_ env vars
SED_ARGS=""
printenv | grep NEXT_PUBLIC_ | while read -r line; do
  key=$(echo "$line" | cut -d "=" -f1)
  value=$(echo "$line" | cut -d "=" -f2-)
  echo "Replace: $key"
  SED_ARGS="$SED_ARGS -e s|$key|$value|g"
done > /dev/null

# Reconstruct SED_ARGS (subshell workaround)
SED_ARGS=""
for line in $(printenv | grep NEXT_PUBLIC_); do
  key=$(echo "$line" | cut -d "=" -f1)
  value=$(echo "$line" | cut -d "=" -f2-)
  SED_ARGS="$SED_ARGS -e s|$key|$value|g"
done

echo "Replacing env vars in .next build output..."
find /app/.next/ -type f \( -name '*.js' -o -name '*.json' -o -name '*.html' \) -exec sed -i $SED_ARGS {} +
echo "Done."

# Execute the container's main process (CMD in Dockerfile)
exec "$@"
