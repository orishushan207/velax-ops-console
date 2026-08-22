#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# VELA-X Ops Console — הקמת מסד הנתונים המרוחק
#
# מסד הנתונים כבר קיים ב־Netlify. הסקריפט מאתר את מחרוזת החיבור,
# יוצר את הסכימה ואת מדיניות ה־RLS, וטוען את נתוני ההדגמה.
#
# הרצה:  bash scripts/setup-remote-db.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

SITE_ID="22ec4934-8a0b-4fb3-a7c7-e11befd6902b"
cd "$(dirname "$0")/.."

step() { printf '\n\033[1;32m▸ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n\n' "$1" >&2; exit 1; }

ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:-<REDACTED>}"

step "1/4 · התחברות ל־Netlify"
if npx netlify status >/dev/null 2>&1; then
  echo "כבר מחובר."
else
  echo "נפתח דפדפן לאישור הגישה — אשר וחזור לטרמינל."
  npx netlify login
fi

step "2/4 · קישור לפרויקט"
npx netlify link --id "$SITE_ID" >/dev/null 2>&1 || true

# Netlify מזריק את מחרוזת החיבור אוטומטית; DATABASE_URL גובר עליה אם הוגדר ידנית
DB_URL=""
for KEY in DATABASE_URL NETLIFY_DATABASE_URL NETLIFY_DATABASE_URL_UNPOOLED; do
  VAL="$(npx netlify env:get "$KEY" 2>/dev/null | tr -d '[:space:]' || true)"
  if [ -n "$VAL" ] && [ "$VAL" != "null" ] && [ "${VAL#postgres}" != "$VAL" ]; then
    DB_URL="$VAL"; echo "נמצאה מחרוזת חיבור דרך $KEY"; break
  fi
done

[ -z "$DB_URL" ] && fail "לא נמצאה מחרוזת חיבור.
פתח את המסד בלוח הבקרה:
  https://app.netlify.com/projects/velax-ops-console/configuration/database
או הגדר מסד חיצוני:
  npx netlify env:set DATABASE_URL 'postgresql://...'
ואז הרץ שוב."

step "3/4 · יצירת הסכימה ומדיניות RLS"
DATABASE_URL="$DB_URL" APP_ENV=demo npm run db:migrate

step "4/4 · טעינת נתוני ההדגמה"
# ⚠ מוחק וטוען מחדש. אל תריץ אחרי שהוזנו נתונים אמיתיים.
# ⚠ SEED_ADMIN_PASSWORD חובה: בלעדיו הטעינה מגדירה את סיסמת ההדגמה
#   המתועדת ב־repo, על אתר שכתובתו ציבורית.
DATABASE_URL="$DB_URL" APP_ENV=demo SEED_ADMIN_PASSWORD="$ADMIN_PASSWORD" npm run db:seed

printf '\n\033[1;32m✓ המסד מוכן.\033[0m\n'
printf 'הקונסולה זמינה מיד:  https://velax-ops-console.netlify.app\n'
printf 'משתמש:  admin@velax.co.il\n'
printf 'סיסמה:  %s\n\n' "$ADMIN_PASSWORD" 
