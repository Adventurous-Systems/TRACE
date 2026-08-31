#!/usr/bin/env bash
set -euo pipefail

# Creates the MinIO service account the API authenticates with.
#
# The API reads MINIO_ACCESS_KEY/MINIO_SECRET_KEY from .env, but nothing ever
# created that user inside MinIO — so the API dies at startup with
# "S3Error: The Access Key Id you provided does not exist in our records"
# and crash-loops. This script closes that gap.
#
# Idempotent: safe to re-run. Re-run it after any MinIO volume reset, since
# IAM users live in the volume (.minio.sys/config/iam), not in docker-compose.
#
# Usage:
#   scripts/provision-minio-user.sh <compose-dir> <minio-container>
#
# Examples:
#   scripts/provision-minio-user.sh /opt/TRACE-staging trace-staging-minio-1
#   scripts/provision-minio-user.sh /opt/TRACE         trace-minio-1
#   scripts/provision-minio-user.sh .                  trace-minio-1   # local dev
#
# Policy: the built-in "readwrite" (s3:*). The API's ensureBucket() calls
# bucketExists/makeBucket/setBucketPolicy at startup (packages/api/src/lib/storage.ts),
# so an object-only policy is not sufficient.

COMPOSE_DIR="${1:-}"
MINIO_CONTAINER="${2:-}"

if [[ -z "$COMPOSE_DIR" || -z "$MINIO_CONTAINER" ]]; then
  echo "Usage: $0 <compose-dir> <minio-container>" >&2
  echo "  e.g. $0 /opt/TRACE trace-minio-1" >&2
  exit 1
fi

ENV_FILE="$COMPOSE_DIR/.env"
[[ -f "$ENV_FILE" ]] || { echo "No .env at $ENV_FILE" >&2; exit 1; }

# Root credentials are hardcoded in docker-compose.yml's minio service.
ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"

# Read the app's credentials without echoing them.
ACCESS_KEY="$(grep -E '^MINIO_ACCESS_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
SECRET_KEY="$(grep -E '^MINIO_SECRET_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2-)"

if [[ -z "$ACCESS_KEY" || -z "$SECRET_KEY" ]]; then
  echo "MINIO_ACCESS_KEY / MINIO_SECRET_KEY not set in $ENV_FILE" >&2
  exit 1
fi

if [[ "$ACCESS_KEY" == "$ROOT_USER" ]]; then
  echo "==> .env uses the MinIO root credentials directly — no service account needed."
  exit 0
fi

echo "==> Provisioning MinIO user '${ACCESS_KEY:0:8}…' in $MINIO_CONTAINER"

docker run --rm \
  --network "container:$MINIO_CONTAINER" \
  -e MC_HOST_target="http://${ROOT_USER}:${ROOT_PASSWORD}@127.0.0.1:9000" \
  -e ACCESS_KEY="$ACCESS_KEY" \
  -e SECRET_KEY="$SECRET_KEY" \
  --entrypoint sh minio/mc -c '
    set -e
    if mc admin user info target "$ACCESS_KEY" >/dev/null 2>&1; then
      echo "    user already exists — skipping create"
    else
      mc admin user add target "$ACCESS_KEY" "$SECRET_KEY"
      echo "    user created"
    fi

    # Newer mc uses "policy attach"; older releases use "policy set".
    if ! mc admin policy attach target readwrite --user "$ACCESS_KEY" 2>/dev/null; then
      mc admin policy set target readwrite user="$ACCESS_KEY" 2>/dev/null \
        || echo "    policy already attached"
    fi
    echo "    policy: readwrite"

    echo ""
    echo "    users now configured:"
    mc admin user list target
  '

echo ""
echo "Done. Restart the API so it picks up working credentials:"
echo "  cd $COMPOSE_DIR && docker compose restart api"
