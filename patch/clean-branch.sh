#!/bin/sh
# Squash an Agentflow work branch onto a new clean branch that contains no
# Agentflow working files (.agentflow/, ag.json), no Agentflow-only .gitignore
# changes and no Agentflow-Close-Id trailers, ready to push.
#
# Usage: sh clean-branch.sh <work-branch> [options]
#   -b <branch>        clean branch name (default: <work-branch>-clean)
#   -B <base>          start point (default: <remote>/HEAD, else <remote>/main)
#   -r <remote>        remote to fetch from and push to (default: origin)
#   -m <message>       commit message (default: edit the squashed log in $EDITOR)
#   --keep-gitignore   keep the work branch's .gitignore changes
#   --no-fetch         skip fetching the remote
#   --push             push the clean branch after verification
set -eu

agentflow_paths='.agentflow ag.json'
trailer_pattern='^[[:space:]]*Agentflow-Close-Id:'

die() { printf 'clean-branch: %s\n' "$*" >&2; exit 1; }
usage() { sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

work='' clean='' base='' remote='origin' message=''
keep_gitignore=0 fetch=1 push=0
while [ $# -gt 0 ]; do
  case "$1" in
    -b) [ $# -ge 2 ] || die "-b needs a value"; clean=$2; shift 2 ;;
    -B) [ $# -ge 2 ] || die "-B needs a value"; base=$2; shift 2 ;;
    -r) [ $# -ge 2 ] || die "-r needs a value"; remote=$2; shift 2 ;;
    -m) [ $# -ge 2 ] || die "-m needs a value"; message=$2; shift 2 ;;
    --keep-gitignore) keep_gitignore=1; shift ;;
    --no-fetch) fetch=0; shift ;;
    --push) push=1; shift ;;
    -h|--help) usage 0 ;;
    -*) die "unknown option: $1" ;;
    *) [ -z "$work" ] || die "only one work branch may be given"; work=$1; shift ;;
  esac
done
[ -n "$work" ] || usage 1

git rev-parse --git-dir >/dev/null 2>&1 || die "not inside a Git repository"
cd "$(git rev-parse --show-toplevel)"

git rev-parse --verify -q "refs/heads/$work^{commit}" >/dev/null || die "local branch '$work' not found"
[ -n "$clean" ] || clean="$work-clean"
git check-ref-format --branch "$clean" >/dev/null 2>&1 || die "invalid branch name '$clean'"
git rev-parse --verify -q "refs/heads/$clean" >/dev/null && die "branch '$clean' already exists; choose another name with -b"
if ! git diff --quiet || ! git diff --cached --quiet; then
  die "commit or stash tracked changes before running this script"
fi

if [ "$fetch" = 1 ]; then
  git fetch -q "$remote" || die "could not fetch '$remote' (use --no-fetch to skip)"
fi
if [ -z "$base" ]; then
  base=$(git symbolic-ref -q --short "refs/remotes/$remote/HEAD" 2>/dev/null || true)
  [ -n "$base" ] || base="$remote/main"
fi
git rev-parse --verify -q "$base^{commit}" >/dev/null || die "base '$base' not found; pass it with -B"

start=$(git symbolic-ref -q --short HEAD || git rev-parse HEAD)
# Safe because the tracked tree was clean before the branch was created.
rollback() {
  git reset -q --hard
  git switch -q "$start" 2>/dev/null || git switch -q --detach "$start"
  git branch -q -D "$clean"
}

git switch -q --no-track -c "$clean" "$base" || die "could not create '$clean' from '$base'"
if ! git merge --squash "$work" >/dev/null 2>&1; then
  rollback
  die "squashing '$work' onto '$base' conflicts; merge or rebase '$base' into '$work' first"
fi

# Keep the base's copy when it has one; otherwise drop the path entirely.
restore_or_remove() {
  if git cat-file -e "HEAD:$1" 2>/dev/null; then
    git restore --source=HEAD --staged --worktree -- "$1"
  else
    git rm -r -q -f --ignore-unmatch -- "$1" >/dev/null
  fi
}
for path in $agentflow_paths; do restore_or_remove "$path"; done
[ "$keep_gitignore" = 1 ] || restore_or_remove .gitignore

if git diff --cached --quiet; then
  rollback
  die "nothing left to commit after removing Agentflow files"
fi

if [ -n "$message" ]; then
  git commit -q -m "$message" || die "commit failed; '$clean' keeps the staged changes"
else
  msg_file=$(git rev-parse --git-path SQUASH_MSG)
  draft=$(git rev-parse --git-path CLEAN_BRANCH_MSG)
  grep -v "$trailer_pattern" "$msg_file" >"$draft" || true
  if ! git commit -q -e -F "$draft"; then
    rm -f "$draft"
    die "commit aborted; '$clean' keeps the staged changes (commit manually or run: git reset --hard && git switch $start && git branch -D $clean)"
  fi
  rm -f "$draft"
fi

# Same checks as the pre-push hook, applied to the new commit.
# shellcheck disable=SC2086
leftover=$(git ls-tree -r --name-only HEAD -- $agentflow_paths | head -n 1)
[ -z "$leftover" ] || die "verification failed: '$leftover' is still in '$clean'"
if git log --format=%B "$base..HEAD" | grep -q "$trailer_pattern"; then
  die "verification failed: an Agentflow-Close-Id trailer is still in '$clean'"
fi

echo "clean-branch: created '$clean' from '$base' with $(git rev-list --count "$base..HEAD") commit:"
git --no-pager log -1 --format='  %h %s'
git --no-pager diff --stat "$base..HEAD" | tail -n 1

if [ "$push" = 1 ]; then
  git push -u "$remote" "$clean"
else
  echo "next: review with 'git diff $base..$clean', then push with: git push -u $remote $clean"
fi
echo "your Agentflow history stays on '$work'; return with: git switch $work"
