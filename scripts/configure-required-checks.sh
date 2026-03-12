#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  configure-required-checks.sh [--repo owner/name] [--branch main] [--check build]

Notes:
  - Requires GitHub CLI auth with admin rights on the target repo.
  - This script enforces CI check(s) before merge by updating branch protection.
EOF
}

REPO=""
BRANCH="main"
CHECK_CONTEXTS=("build")

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO="$2"
      shift 2
      ;;
    --branch)
      BRANCH="$2"
      shift 2
      ;;
    --check)
      CHECK_CONTEXTS+=("$2")
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$REPO" ]]; then
  REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
fi

if [[ ${#CHECK_CONTEXTS[@]} -gt 1 && "${CHECK_CONTEXTS[0]}" == "build" ]]; then
  CHECK_CONTEXTS=("${CHECK_CONTEXTS[@]:1}")
fi

if [[ ${#CHECK_CONTEXTS[@]} -eq 0 ]]; then
  echo "At least one --check context is required."
  exit 1
fi

echo "Applying required checks to ${REPO} branch ${BRANCH}: ${CHECK_CONTEXTS[*]}"

checks_json=""
for ctx in "${CHECK_CONTEXTS[@]}"; do
  if [[ -n "$checks_json" ]]; then
    checks_json+=","
  fi
  checks_json+="{\"context\":\"${ctx}\"}"
done

payload="$(cat <<EOF
{
  "required_status_checks": {
    "strict": true,
    "checks": [${checks_json}]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null
}
EOF
)"

gh api -X PUT "repos/${REPO}/branches/${BRANCH}/protection" \
  -H "Accept: application/vnd.github+json" \
  --input - >/dev/null <<<"${payload}"

echo "Required check policy applied successfully."
