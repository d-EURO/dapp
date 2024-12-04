#!/bin/sh
set -e

cd /app

# Write all "NEXT_PUBLIC_" values to .env file
printenv | grep NEXT_PUBLIC_ > .env

# Build the application
yarn build

# Execute the container's main process (CMD in Dockerfile)
exec "$@"
