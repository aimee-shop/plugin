#!/usr/bin/env bash
# Publish canonical main to the public GitHub repository.
# Uses the existing GitHub SSH login. No stored token. No force push.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CHECK_ONLY=0
if [[ "${1:-}" == "--check" ]]; then
  CHECK_ONLY=1
elif [[ $# -gt 0 ]]; then
  echo "usage: scripts/publish-github.sh [--check]" >&2
  exit 2
fi

git fetch --quiet origin

dirty="$(git status --porcelain)"
if [[ -n "$dirty" ]]; then
  echo "Refusing to publish: working tree is not clean." >&2
  printf '%s\n' "$dirty" >&2
  exit 1
fi

head_sha="$(git rev-parse HEAD)"
main_sha="$(git rev-parse origin/main)"
if [[ "$head_sha" != "$main_sha" ]]; then
  echo "Refusing to publish: HEAD ${head_sha} is not origin/main ${main_sha}." >&2
  echo "Publish only canonical main, never a feature branch." >&2
  exit 1
fi

if command -v claude >/dev/null 2>&1; then
  # This CLI requires a path. Check the marketplace root and the plugin.
  claude plugin validate --strict "$ROOT"
  claude plugin validate --strict "$ROOT/aimee-shop"
else
  echo "claude CLI is not on PATH; skipping plugin validate --strict."
fi

node scripts/validate-packagings.mjs

# Escaped dots keep this file from matching its own search.
private_re='gitlab\.com|Bearer[[:space:]]+[A-Za-z0-9._-]+|sk-[A-Za-z0-9]{10,}'
set +e
git grep -I -n -E "$private_re" -- . ':(exclude)scripts/fixtures'
grep_status=$?
set -e
if [[ "$grep_status" -eq 0 ]]; then
  echo "Private-content grep hit. Refusing to publish." >&2
  exit 1
fi
if [[ "$grep_status" -ne 1 ]]; then
  echo "Private-content grep failed (status ${grep_status})." >&2
  exit 1
fi

print_install() {
  echo "claude plugin marketplace add aimee-shop/plugin"
  echo "claude plugin install aimee@aimee"
}

if [[ "$CHECK_ONLY" -eq 1 ]]; then
  echo "Check passed. ${main_sha} matches origin/main. Not pushing."
  print_install
  exit 0
fi

github_dest="git@github.com:aimee-shop/plugin.git"
if ! git push "$github_dest" "origin/main:refs/heads/main"; then
  echo "Push rejected. If GitHub main has commits that are not on origin/main, the update is not a fast-forward. Not forcing." >&2
  exit 1
fi

remote_sha="$(git ls-remote "$github_dest" refs/heads/main | awk 'NR==1 { print $1 }')"
if [[ "$remote_sha" != "$main_sha" ]]; then
  echo "GitHub main is ${remote_sha:-missing}; expected ${main_sha}." >&2
  exit 1
fi

echo "Published ${remote_sha} to ${github_dest}"
print_install
