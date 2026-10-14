#!/bin/bash
# Owner, 2026-10-14: "keep committing all files in a major change every hour" -- runs on a schedule
# (see scripts/install-hourly-commit.sh), commits and pushes whatever changed in the last hour.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "$(git status --porcelain)" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') nothing to commit"
  exit 0
fi

git add -A
git commit -m "$(cat <<'EOF'
Automated hourly sync

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
echo "$(date '+%Y-%m-%d %H:%M:%S') committed and pushed"
