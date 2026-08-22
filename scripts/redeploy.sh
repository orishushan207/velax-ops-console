#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# VELA-X Ops Console — פריסה מחדש ל־Netlify
#
# דורש שהרצת קודם את setup-remote-db.sh (שמחבר את Netlify CLI).
# הפריסה בונה מקומית ומעלה רק את תוצר הבנייה.
#
# הרצה:  bash scripts/redeploy.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

SITE_ID="22ec4934-8a0b-4fb3-a7c7-e11befd6902b"
cd "$(dirname "$0")/.."

printf '\n\033[1;32m▸ מוודא חיבור ל־Netlify\033[0m\n'
npx netlify status >/dev/null 2>&1 || npx netlify login
npx netlify link --id "$SITE_ID" >/dev/null 2>&1 || true

printf '\n\033[1;32m▸ בונה ופורס\033[0m\n'
npx netlify deploy --build --prod

printf '\n\033[1;32m✓ הפריסה הושלמה\033[0m\n'
printf 'https://velax-ops-console.netlify.app\n\n'
