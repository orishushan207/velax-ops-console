#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# VELA-X Ops Console — הקמת מסד הנתונים המרוחק
#
# מריץ פעם אחת: מחבר את Netlify CLI, מאתר את מסד הנתונים של האתר,
# מריץ את ה־migrations ואת מדיניות ה־RLS, וטוען את נתוני ההדגמה.
#
# הרצה:  bash scripts/setup-remote-db.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

SITE_ID="22ec4934-8a0b-4fb3-a7c7-e11befd6902b"
cd "$(dirname "$0")/.."

step() { printf '\n\033[1;32m▸ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

step "1/5 · התחברות ל־Netlify"
if ! npx netlify status >/dev/null 2>&1; then
  echo "נפתח דפדפן לאישור הגישה..."
  npx netlify login
else
  echo "כבר מחובר."
fi

step "2/5 · קישור לפרויקט velax-ops-console"
npx netlify link --id "$SITE_ID" >/dev/null 2>&1 || true
npx netlify status | head -8

step "3/5 · איתור מסד הנתונים"
DB_URL="$(npx netlify env:get NETLIFY_DATABASE_URL 2>/dev/null | tr -d '[:space:]' || true)"

if [ -z "$DB_URL" ] || [ "$DB_URL" = "null" ]; then
  echo "לא נמצא מסד. מקים מסד Netlify DB חדש..."
  npx netlify db init --assume-no --boilerplate=none 2>/dev/null \
    || npx netlify db init 2>/dev/null \
    || true
  DB_URL="$(npx netlify env:get NETLIFY_DATABASE_URL 2>/dev/null | tr -d '[:space:]' || true)"
fi

if [ -z "$DB_URL" ] || [ "$DB_URL" = "null" ]; then
  fail "לא הצלחתי לאתר מחרוזת חיבור.
נסה להקים מסד ידנית:  npx netlify db init
או הגדר מסד חיצוני (Neon/Supabase):
  npx netlify env:set DATABASE_URL 'postgresql://...'
ואז הרץ שוב את הסקריפט."
fi

echo "✓ נמצא מסד נתונים"

step "4/5 · הרצת migrations ומדיניות RLS"
# APP_ENV=demo — הגנת ה־seed חוסמת רק סביבת production אמיתית
DATABASE_URL="$DB_URL" APP_ENV=demo npm run db:migrate

step "5/5 · טעינת נתוני ההדגמה"
DATABASE_URL="$DB_URL" APP_ENV=demo npm run db:seed

# האתר קורא DATABASE_URL; מוודאים שהוא מוגדר גם ב־Netlify
npx netlify env:set DATABASE_URL "$DB_URL" --context production --secret >/dev/null 2>&1 \
  || npx netlify env:set DATABASE_URL "$DB_URL" >/dev/null 2>&1 || true

printf '\n\033[1;32m✓ המסד מוכן.\033[0m\n'
printf 'כעת הרץ פריסה מחדש כדי שהאתר יתחבר אליו:\n'
printf '  bash scripts/redeploy.sh\n\n'
