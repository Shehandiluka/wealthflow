#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

echo "→ Checking Cloudflare login..."
if ! npx wrangler whoami >/dev/null 2>&1; then
  echo "→ Not logged in yet. Opening browser to authorize Cloudflare (one-time)..."
  npx wrangler login
fi

echo "→ Building..."
npm run build

echo "→ Deploying to Cloudflare Workers..."
npx wrangler deploy
