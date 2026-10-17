#!/bin/sh
# Check LunchLoop-Setup trailers for commits in a revision range.

set -eu

if [ "$#" -ne 2 ]; then
  printf '%s\n' "Usage: $0 <base> <head>" >&2
  exit 2
fi

if [ -z "${SETUP_KEY:-}" ]; then
  printf '%s\n' 'SETUP_KEY secret is not set on this repo.' >&2
  exit 2
fi

key=$(printf '%s' "$SETUP_KEY" | tr -d '[:space:]\r')

base=$1
head=$2

# An empty or all-zero base is used by GitHub for a first push.
if [ -z "$base" ]; then
  printf '%s\n' 'Nothing to check.'
  exit 0
fi
case "$base" in
  *[!0]*) ;;
  *)
    printf '%s\n' 'Nothing to check.'
    exit 0
    ;;
esac

if ! commits=$(git rev-list "$base..$head"); then
  exit 1
fi

if [ -z "$commits" ]; then
  printf '%s\n' 'Nothing to check.'
  exit 0
fi

checked=0
failed=0

for commit in $commits; do
  tree=$(git rev-parse "$commit^{tree}")
  expected=$(printf '%s %s' "$key" "$tree" | git hash-object --stdin | cut -c1-16)

  trailers=$(git log -1 --format='%(trailers:key=LunchLoop-Setup,valueonly)' "$commit")
  if [ -z "$trailers" ]; then
    trailer_count=0
    last_trailer=
  else
    trailer_count=$(printf '%s\n' "$trailers" | awk 'END { print NR }')
    last_trailer=$(printf '%s\n' "$trailers" | tail -n 1 | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
  fi
  short_subject=$(git log -1 --format='%h %s' "$commit")

  checked=$((checked + 1))
  if [ "$trailer_count" -eq 0 ]; then
    printf '%s: missing trailer\n' "$short_subject" >&2
    failed=$((failed + 1))
  elif [ "$last_trailer" != "$expected" ]; then
    printf '%s: trailer does not match\n' "$short_subject" >&2
    failed=$((failed + 1))
  fi
done

if [ "$failed" -ne 0 ]; then
  cat >&2 <<'EOF'

Every commit needs a valid LunchLoop-Setup line, which the team's commit hook adds.
To fix this without force pushing:
  1. Install the team setup kit (see the setup repo README).
  2. Move your work onto a fresh branch as one signed commit:
       git fetch origin
       git checkout -b <your-branch>-2 origin/main
       git merge --squash <your-branch>
       git commit -m "<what the work does>"
       git push -u origin <your-branch>-2
  3. Open the pull request from the new branch.
EOF
  exit 1
fi

printf 'Checked %d commit(s); all signatures valid.\n' "$checked"
