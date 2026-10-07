#!/bin/sh
# One-time setup of a Mac for this repo and the booking-link search (docs/booking-links/RULES.md section 5).
# Run from anywhere:   sh scripts/mac/setup.sh [--check] [--all]
# Installs only what is missing with Homebrew (Node.js here; the rest is done by `node scripts/setup.mjs`, the same
# command as `npm run setup`): whatever is already installed is left alone.
cd "$(dirname "$0")/../.." || exit 1
if ! command -v node >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then brew install node; else echo "Node.js and Homebrew are missing: install Homebrew from https://brew.sh, then run this again."; exit 1; fi
fi
exec node scripts/setup.mjs "$@"
