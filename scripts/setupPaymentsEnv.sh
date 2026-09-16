#!/usr/bin/env bash
# One-time payments setup for the Vercel project. Prints no secret.
#
#   bash scripts/setupPaymentsEnv.sh <firebase-service-account.json> [env-file-with-YOCO_SECRET_KEY]
#
# Arg 1: JSON from Firebase console → Project settings → Service accounts →
#        "Generate new private key" (for the scripturecomix project).
# Arg 2: optional file containing a line YOCO_SECRET_KEY=sk_... ; when omitted,
#        YOCO_SECRET_KEY must already be exported in this shell.
set -euo pipefail
cd "$(dirname "$0")/.."
unset VERCEL_TOKEN
SCOPE="${VERCEL_SCOPE:-konvrg-dev-team}"
SITE="${APP_URL:-https://scripture-comix.vercel.app}"

SA_JSON="${1:-}"
ENV_FILE="${2:-}"
# No second argument: fall back to the sibling project's env file if it is there
# (the user agreed to borrow its Yoco key for the first run).
if [ -z "$ENV_FILE" ] && [ -z "${YOCO_SECRET_KEY:-}" ] && [ -f "../whatsapp-book/.env.local" ]; then
  ENV_FILE="../whatsapp-book/.env.local"
fi
if [ -z "$SA_JSON" ] || [ ! -f "$SA_JSON" ]; then
  echo "First argument must be the Firebase service-account JSON file (got: '${SA_JSON}')." >&2
  echo "Firebase console → Project settings → Service accounts → Generate new private key." >&2
  exit 2
fi
if ! grep -q '"project_id": *"scripturecomix"' "$SA_JSON"; then
  echo "That service account is not for the scripturecomix project." >&2
  exit 2
fi

put() { # name value environment
  npx --no-install vercel env rm "$1" "$3" --yes --scope "$SCOPE" >/dev/null 2>&1 || true
  printf '%s' "$2" | npx --no-install vercel env add "$1" "$3" --scope "$SCOPE" 2>&1 | grep -E "Added|Error" | sed "s|^|[$1/$3] |"
}

echo "== Firebase service account =="
SA_B64=$(base64 -w0 < "$SA_JSON")
put FIREBASE_SERVICE_ACCOUNT "$SA_B64" production
put FIREBASE_SERVICE_ACCOUNT "$SA_B64" preview

echo "== Yoco secret key =="
if [ -n "$ENV_FILE" ]; then
  [ -f "$ENV_FILE" ] || { echo "Env file not found: $ENV_FILE" >&2; exit 2; }
  YOCO_SECRET_KEY=$(grep -E '^YOCO_SECRET_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
fi
: "${YOCO_SECRET_KEY:?YOCO_SECRET_KEY not found}"
export YOCO_SECRET_KEY
case "$YOCO_SECRET_KEY" in
  sk_test*) echo "Yoco mode: TEST (no real money)";;
  sk_live*) echo "Yoco mode: LIVE (real money will move)";;
  *) echo "Yoco key has an unexpected prefix; continuing";;
esac
put YOCO_SECRET_KEY "$YOCO_SECRET_KEY" production
put YOCO_SECRET_KEY "$YOCO_SECRET_KEY" preview

echo "== Register the webhook (signing secret goes straight into Vercel) =="
node scripts/registerYocoWebhook.mjs register "$SITE/api/yoco-webhook" --vercel production

echo "== APP_URL =="
put APP_URL "$SITE" production

echo "== Redeploy production so the functions pick up the new variables =="
npx --no-install vercel redeploy "$SITE" --scope "$SCOPE" 2>&1 | tail -2
echo
echo "Done. Make a small test payment, then confirm with:"
echo "  YOCO_SECRET_KEY=... YOCO_WEBHOOK_SECRET=... node scripts/registerYocoWebhook.mjs check"
