#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: must run inside a git repository."
  exit 1
fi

default_base="origin/main"
base_ref="${LINT_BASE_REF:-$default_base}"

if ! git rev-parse --verify "$base_ref" >/dev/null 2>&1; then
  echo "Base ref '$base_ref' not found locally. Fetching origin/main..."
  git fetch origin main >/dev/null 2>&1 || true
fi

if git rev-parse --verify "$base_ref" >/dev/null 2>&1; then
  merge_base="$(git merge-base HEAD "$base_ref")"
else
  merge_base="$(git rev-list --max-parents=0 HEAD | tail -n 1)"
fi

changed_files="$(git diff --name-only --diff-filter=ACMR "$merge_base"...HEAD)"

if [[ -z "${changed_files}" ]]; then
  echo "No changed files detected for lint."
  exit 0
fi

lint_targets=()
while IFS= read -r file; do
  case "$file" in
    *.js|*.jsx|*.ts|*.tsx|*.mjs|*.cjs)
      lint_targets+=("$file")
      ;;
  esac
done <<< "$changed_files"

if [[ ${#lint_targets[@]} -eq 0 ]]; then
  echo "No changed JS/TS files to lint."
  exit 0
fi

echo "Linting changed files:"
printf ' - %s\n' "${lint_targets[@]}"
npx eslint --cache --cache-location .cache/eslint/.eslintcache "${lint_targets[@]}"
