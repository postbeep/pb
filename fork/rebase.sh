#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: fork/rebase.sh <upstream-tag> [--branch <name>] [--only <change>] [--no-checks]" >&2
  exit 2
}

fail() {
  echo "fork/rebase.sh: $*" >&2
  exit 2
}

if [[ -z "${FORK_REBASE_COPY:-}" ]]; then
  copy="$(mktemp -t fork-rebase.XXXXXX)"
  cp "$0" "$copy"
  FORK_REBASE_COPY="$copy" exec bash "$copy" "$@"
fi
trap 'rm -f "$FORK_REBASE_COPY"' EXIT

new_tag=""
new_branch=""
only=""
run_checks=1
while (($#)); do
  case "$1" in
    --branch)
      (($# >= 2)) || usage
      new_branch="$2"
      shift 2
      ;;
    --only)
      (($# >= 2)) || usage
      only="$2"
      shift 2
      ;;
    --no-checks)
      run_checks=0
      shift
      ;;
    -*) usage ;;
    *)
      [[ -z "$new_tag" ]] || usage
      new_tag="$1"
      shift
      ;;
  esac
done
[[ -n "$new_tag" ]] || usage
[[ "$new_tag" == desktop-v* ]] || fail "the tag must be an upstream release tag, desktop-v<version>"

cd "$(git rev-parse --show-toplevel)"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fail "commit or stash tracked changes first"
git remote get-url upstream >/dev/null 2>&1 || fail "add the upstream remote first (see fork/README.md)"

old_branch="$(git symbolic-ref --quiet --short HEAD || true)"
[[ "$old_branch" == fork/v* ]] || fail "check out a fork/v<version> branch first"
old_tag="desktop-${old_branch#fork/}"
new_branch="${new_branch:-fork/${new_tag#desktop-}}"
if git show-ref --verify --quiet "refs/heads/$new_branch"; then
  fail "branch $new_branch already exists"
fi

git fetch --quiet --no-tags upstream tag "$old_tag" tag "$new_tag"
git merge-base --is-ancestor "$old_tag" HEAD || fail "$old_branch is not built on $old_tag"
[[ -z "$(git rev-list --merges "$old_tag..HEAD")" ]] || fail "$old_branch contains merge commits; keep fork commits linear"

commits=()
if [[ -n "$only" ]]; then
  while IFS= read -r commit; do commits+=("$commit"); done \
    < <(git rev-list --reverse --grep="^Fork-Change: ${only}\$" "$old_tag..HEAD")
else
  while IFS= read -r commit; do commits+=("$commit"); done \
    < <(git rev-list --reverse "$old_tag..HEAD")
fi
((${#commits[@]} > 0)) || fail "no fork commits to move from $old_branch${only:+ for $only}"

for commit in "${commits[@]}"; do
  if [[ -z "$(git log -1 --format='%(trailers:key=Fork-Change,valueonly)' "$commit")" ]]; then
    echo "fork/rebase.sh: $(git log -1 --format='%h %s' "$commit") has no Fork-Change trailer" >&2
  fi
done

echo "Moving ${#commits[@]} commit(s) from $old_branch ($old_tag) to $new_branch ($new_tag)"
git switch --quiet -c "$new_branch" "$new_tag"
if ! git cherry-pick "${commits[@]}" >/dev/null 2>&1; then
  conflicted="$(git diff --name-only --diff-filter=U)"
  stopped_at="$(git rev-parse --short CHERRY_PICK_HEAD 2>/dev/null || echo "an unknown commit")"
  git cherry-pick --abort >/dev/null 2>&1 || git reset --quiet --hard
  git switch --quiet "$old_branch"
  git branch --quiet -D "$new_branch"
  echo "fork/rebase.sh: $stopped_at does not apply to $new_tag." >&2
  if [[ -n "$conflicted" ]]; then
    echo "Conflicting files:" >&2
    printf '  %s\n' $conflicted >&2
  fi
  echo "$new_branch was removed; $old_branch is unchanged." >&2
  exit 1
fi

footprint() {
  local change="$1"
  local count
  count="$(git rev-list --count --grep="^Fork-Change: ${change}\$" "$new_tag..HEAD")"
  echo
  echo "Footprint of $change ($count commit(s)):"
  git log --format= --numstat --no-renames --grep="^Fork-Change: ${change}\$" "$new_tag..HEAD" |
    awk -F '\t' '{ lines[$3] += ($1 == "-" ? 0 : $1) + ($2 == "-" ? 0 : $2) } END { for (p in lines) print lines[p] "\t" p }' |
    sort -t "$(printf '\t')" -k2 |
    while IFS="$(printf '\t')" read -r lines path; do
      if git cat-file -e "$new_tag:$path" 2>/dev/null; then
        printf 'edited\t%s\t%s\n' "$lines" "$path"
      else
        printf 'new\t%s\t%s\n' "$lines" "$path"
      fi
    done |
    awk -F '\t' '
      $1 == "edited" { edited++; changed += $2; edits = edits sprintf("    %s (%d lines)\n", $3, $2) }
      $1 == "new" { added++; news = news sprintf("    %s\n", $3) }
      $3 !~ /^(apps\/mobile|fork)\// { outside = outside sprintf("    %s\n", $3) }
      $3 ~ /(^|\/)package\.json$/ || $3 == "pnpm-lock.yaml" || $3 ~ /^packages\// { forbidden = forbidden sprintf("    %s\n", $3) }
      END {
        printf "  edited upstream files: %d, changed lines in them: %d\n%s", edited, changed, edits
        printf "  new files: %d\n%s", added, news
        printf "  outside apps/mobile/ and fork/: %s\n%s", (outside == "" ? "none" : ""), outside
        printf "  package.json, pnpm-lock.yaml, or packages/: %s\n%s", (forbidden == "" ? "none" : ""), forbidden
      }'
}

while IFS= read -r change; do
  [[ -n "$change" ]] && footprint "$change"
done < <(git log --format='%(trailers:key=Fork-Change,valueonly)' "$new_tag..HEAD" | sed '/^$/d' | sort -u)

echo
echo "$new_branch is at $(git rev-parse --short HEAD), on $new_tag ($(git rev-parse --short "$new_tag^{commit}"))."

if ((run_checks)); then
  if ! command -v pnpm >/dev/null 2>&1; then
    shims="$(mktemp -d -t fork-rebase-bin.XXXXXX)"
    corepack enable --install-directory "$shims" pnpm
    PATH="$shims:$PATH"
  fi
  export TURBO_TELEMETRY_DISABLED=1 COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  echo
  echo "Running checks: install, then typecheck, lint, and test for @bb/mobile"
  if ! pnpm install --frozen-lockfile ||
    ! pnpm exec turbo run typecheck lint test --filter=@bb/mobile --output-logs=errors-only; then
    echo "fork/rebase.sh: checks failed on $new_branch; it is kept for inspection." >&2
    exit 3
  fi
  echo "Checks passed."
fi
