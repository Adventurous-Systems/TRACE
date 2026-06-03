#!/usr/bin/env bash
set -euo pipefail

# Wipes Thor Solo state and restarts the container with a clean chain.
#
# Run this when you need a fresh blockchain (corrupted state, major contract
# rewrite, or want a clean slate for testing).
#
# After this script completes, redeploy contracts and update .env:
#   pnpm --filter @trace/contracts deploy:solo
#   # then copy the printed addresses into .env and restart the API:
#   docker compose restart api
#
# The volume name is derived from the Docker Compose project name.
# If your COMPOSE_PROJECT_NAME differs from "trace-staging", update VOLUME below.

VOLUME="trace-staging_thor-data"

echo "==> Stopping thor-solo container..."
docker compose stop thor-solo

echo "==> Removing thor-solo container..."
docker compose rm -f thor-solo

echo "==> Removing volume: $VOLUME"
docker volume rm "$VOLUME" || echo "    Volume not found — already clean"

echo "==> Starting fresh thor-solo..."
docker compose up -d thor-solo

echo ""
echo "Thor Solo is running with a clean chain."
echo ""
echo "Next steps:"
echo "  1. pnpm --filter @trace/contracts deploy:solo"
echo "  2. Copy MATERIAL_REGISTRY_ADDRESS, MARKETPLACE_ADDRESS, QUALITY_ASSURANCE_ADDRESS into .env"
echo "  3. docker compose restart api"
