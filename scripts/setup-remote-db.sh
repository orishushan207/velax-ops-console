#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# VELA-X Ops Console — הקמת מסד הנתונים המרוחק
#
# מסד הנתונים כבר קיים ב־Netlify אך ריק. הסקריפט יוצר את הסכימה,
# מחיל את מדיניות ה־RLS וטוען את נתוני ההדגמה.
#
# הרצה:  bash scripts/setup-remote-db.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

SITE_ID="22ec4934-8a0b-4fb3-a7c7-e11befd6902b"
cd "$(dirname "$0")/.."

ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:-<REDACTED>}"

step() { printf '\n\033[1;32m▸ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n\n' "$1" >&2; exit 1; }

step "1/4 · התחברות ל־Netlify"
if npx netlify status >/dev/null 2>&1; then
  echo "כבר מחובר."
else
  echo "נפתח דפדפן לאישור הגישה — אשר וחזור לטרמינל."
  npx netlify login
fi

step "2/4 · איתור מסד הנתונים"
npx netlify link --id "$SITE_ID" >/dev/null 2>&1 || true

# ⚠ Netlify אינו חושף את מחרוזת החיבור כמשתנה סביבה רגיל.
# dev:exec מריץ פקודה מקומית עם סביבת האתר מוזרקת, וכך מקבלים אותה.
DB_URL="$(npx netlify dev:exec node -e \
  'process.stdout.write(process.env.NETLIFY_DATABASE_URL || process.env.NETLIFY_DATABASE_URL_UNPOOLED || "")' \
  2>/dev/null | tr -d '[:space:]' | grep -oE 'postgres[a-z]*://[^[:space:]]+' | head -1 || true)"

[ -z "$DB_URL" ] && fail "לא הצלחתי לאתר את מחרוזת החיבור.
פתח את המסד בלוח הבקרה והעתק את ה־connection string:
  https://app.netlify.com/projects/velax-ops-console/extensions/neon
ואז הרץ:
  SEED_ADMIN_PASSWORD='$ADMIN_PASSWORD' DATABASE_URL='postgresql://...' bash scripts/setup-remote-db.sh"

# ⚠ הגנה קריטית: .env המקומי מכיל DATABASE_URL של מסד הפיתוח.
# בלי הבדיקה הזו טעות בהזרקה הייתה מוחקת וטוענת מחדש את המסד המקומי.
case "$DB_URL" in
  *localhost*|*127.0.0.1*)
    fail "מחרוזת החיבור מצביעה על מסד מקומי. עצרתי כדי לא למחוק את מסד הפיתוח." ;;
esac
echo "✓ נמצא מסד מרוחק"

step "3/4 · יצירת הסכימה ומדיניות RLS"
DATABASE_URL="$DB_URL" APP_ENV=demo npm run db:migrate

step "4/4 · טעינת נתוני ההדגמה"
# ⚠ מוחק וטוען מחדש. אל תריץ אחרי שהוזנו נתונים אמיתיים.
# SEED_ADMIN_PASSWORD מונע טעינת סיסמת ההדגמה המתועדת ב־repo.
DATABASE_URL="$DB_URL" APP_ENV=demo SEED_ADMIN_PASSWORD="$ADMIN_PASSWORD" npm run db:seed

printf '\n\033[1;32m✓ המסד מוכן.\033[0m\n'
printf 'הקונסולה זמינה מיד:  https://velax-ops-console.netlify.app\n'
printf 'משתמש:  admin@velax.co.il\n'
printf 'סיסמה:  %s\n\n' "$ADMIN_PASSWORD"
