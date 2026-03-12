#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  workflow-start.sh <type> <name> [--base <branch>] [--run-tests] [--dry-run]

Arguments:
  <type>  feature|feat|fix|bugfix|bug
  <name>  kebab-case short name, for example add-catalog-search

Options:
  --base <branch>  Base branch to start from (default: main)
  --run-tests      Run npm test before creating the branch
  --dry-run        Print commands without executing
  -h, --help       Show this help
EOF
}

log() {
  printf '%s\n' "$*"
}

run() {
  log "+ $*"
  if [[ "${DRY_RUN}" -eq 0 ]]; then
    "$@"
  fi
}

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  log "Error: must run inside a git repository."
  exit 1
fi

TYPE="${1:-}"
NAME="${2:-}"
BASE="main"
RUN_TESTS=0
DRY_RUN=0

if [[ "${TYPE}" == "-h" || "${TYPE}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "${TYPE}" || -z "${NAME}" ]]; then
  usage
  exit 1
fi

shift 2
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      if [[ $# -lt 2 ]]; then
        log "Error: --base requires a value."
        exit 1
      fi
      BASE="$2"
      shift 2
      ;;
    --run-tests)
      RUN_TESTS=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      log "Error: unknown option '$1'."
      usage
      exit 1
      ;;
  esac
done

case "$TYPE" in
  feature|feat) PREFIX="feature/" ;;
  fix|bugfix|bug) PREFIX="fix/" ;;
  *)
    log "Error: invalid type '${TYPE}'. Use feature|feat|fix|bugfix|bug."
    exit 1
    ;;
esac

if [[ ! "$NAME" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  log "Error: branch short name must be kebab-case."
  exit 1
fi

BRANCH="${PREFIX}${NAME}"

if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  log "Error: local branch '${BRANCH}' already exists."
  exit 1
fi

if git ls-remote --exit-code --heads origin "${BRANCH}" >/dev/null 2>&1; then
  log "Error: remote branch '${BRANCH}' already exists on origin."
  exit 1
fi

if [[ "${RUN_TESTS}" -eq 1 ]]; then
  run npm test
fi

run git fetch origin "${BASE}"
run git checkout "${BASE}"
run git pull --ff-only origin "${BASE}"
run git checkout -b "${BRANCH}"
run git push --set-upstream origin "${BRANCH}"

log "Created and switched to '${BRANCH}'."
