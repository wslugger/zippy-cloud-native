#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  workflow-finish.sh --message "<summary>" [options]

Options:
  --message, -m <text>     Commit summary text (required)
  --target <branch>        Merge target branch (default: main)
  --run-lint               Run npm run lint before finishing
  --run-build              Run npm run build before finishing
  --skip-tests             Skip npm test
  --include-untracked      Stage new files in addition to tracked changes
  --delete-branch          Delete source branch locally and on origin after merge
  --dry-run                Print commands without executing
  -h, --help               Show this help
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

MESSAGE=""
TARGET="main"
RUN_LINT=0
RUN_BUILD=0
SKIP_TESTS=0
INCLUDE_UNTRACKED=0
DELETE_BRANCH=0
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --message|-m)
      if [[ $# -lt 2 ]]; then
        log "Error: --message requires a value."
        exit 1
      fi
      MESSAGE="$2"
      shift 2
      ;;
    --target)
      if [[ $# -lt 2 ]]; then
        log "Error: --target requires a value."
        exit 1
      fi
      TARGET="$2"
      shift 2
      ;;
    --run-lint)
      RUN_LINT=1
      shift
      ;;
    --run-build)
      RUN_BUILD=1
      shift
      ;;
    --skip-tests)
      SKIP_TESTS=1
      shift
      ;;
    --include-untracked)
      INCLUDE_UNTRACKED=1
      shift
      ;;
    --delete-branch)
      DELETE_BRANCH=1
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

if [[ -z "${MESSAGE}" ]]; then
  log "Error: --message is required."
  usage
  exit 1
fi

SOURCE="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${SOURCE}" == "HEAD" ]]; then
  log "Error: detached HEAD is not supported."
  exit 1
fi

if [[ "${SOURCE}" == "${TARGET}" ]]; then
  log "Error: source branch and target branch are both '${TARGET}'."
  exit 1
fi

if [[ "${SKIP_TESTS}" -eq 0 ]]; then
  run npm test
fi

if [[ "${RUN_LINT}" -eq 1 ]]; then
  run npm run lint
fi

if [[ "${RUN_BUILD}" -eq 1 ]]; then
  if [[ "${DRY_RUN}" -eq 0 ]]; then
    log "+ DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy npm run build"
    DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npm run build
  else
    log "+ DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy npm run build"
  fi
fi

run git add -u
if [[ "${INCLUDE_UNTRACKED}" -eq 1 ]]; then
  run git add --all
fi

if [[ "${INCLUDE_UNTRACKED}" -eq 0 ]]; then
  UNTRACKED="$(git ls-files --others --exclude-standard)"
  if [[ -n "${UNTRACKED}" ]]; then
    log "Error: untracked files are present. Add them explicitly or use --include-untracked."
    log "${UNTRACKED}"
    exit 1
  fi
fi

PREFIX="chore:"
case "${SOURCE}" in
  feature/*) PREFIX="feat:" ;;
  fix/*) PREFIX="fix:" ;;
esac
COMMIT_MSG="${PREFIX} ${MESSAGE}"

if git diff --cached --quiet; then
  log "No staged file changes to commit."
else
  run git commit -m "${COMMIT_MSG}"
fi

run git fetch origin "${TARGET}"
run git checkout "${TARGET}"
run git pull --ff-only origin "${TARGET}"
run git merge --no-ff "${SOURCE}" -m "Merge ${SOURCE}"
run git push origin "${TARGET}"

if [[ "${DELETE_BRANCH}" -eq 1 ]]; then
  if [[ "${SOURCE}" == "main" || "${SOURCE}" == "master" ]]; then
    log "Error: refusing to delete protected branch '${SOURCE}'."
    exit 1
  fi
  run git branch -d "${SOURCE}"
  run git push origin --delete "${SOURCE}"
fi

log "Finished '${SOURCE}' into '${TARGET}'."
