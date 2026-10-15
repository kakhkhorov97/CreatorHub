#!/bin/bash
# Install root-owned. Uses a separately installed, reviewed Compose configuration.
set -euo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
umask 077
root=/srv/Sean/creatorhub
state=/var/lib/creatorhub-deploy
compose_file=/etc/creatorhub-deploy/compose.yaml
fail() { printf '%s\n' "$*" >&2; exit 1; }
[[ $(id -u) == 0 ]] || fail 'Run using the restricted deployment sudo command.'
[[ $# == 2 ]] || fail 'Expected backend SHA and frontend SHA.'
[[ $1 =~ ^[0-9a-f]{40}$ && $2 =~ ^[0-9a-f]{40}$ ]] || fail 'Full lowercase commit SHAs required.'
backend_sha=$1
frontend_sha=$2
[[ -f $compose_file && -f $root/shared/backend.env && -f $root/shared/frontend.env ]] || fail 'Production configuration is not installed.'
mkdir -p "$state"
exec 9>"$state/deploy.lock"
flock -n 9 || fail 'Another CreatorHub deployment is running.'
release="ci-$(date -u +%Y%m%d%H%M%S)-${backend_sha:0:12}-${frontend_sha:0:12}"
release_dir="$state/releases/$release"
[[ ! -e $release_dir ]] || fail 'Release directory already exists.'
mkdir -p "$release_dir/backend" "$release_dir/frontend"
checkout() {
  local name=$1 url=$2 sha=$3 mirror="$state/$1.git"
  if [[ ! -d $mirror ]]; then git init --bare "$mirror" >/dev/null; fi
  git --git-dir="$mirror" fetch --no-tags "$url" '+refs/heads/develop:refs/heads/develop'
  git --git-dir="$mirror" cat-file -e "$sha^{commit}"
  git --git-dir="$mirror" merge-base --is-ancestor "$sha" refs/heads/develop
  git --git-dir="$mirror" archive "$sha" | tar -x -C "$release_dir/$name"
}
checkout backend https://github.com/kakhkhorov97/CreatorHub.git "$backend_sha"
checkout frontend https://github.com/kakhkhorov97/CreatorHub-next.git "$frontend_sha"
export CREATORHUB_ROOT="$root" CREATORHUB_FRONTEND_CONTEXT="$release_dir/frontend" CREATORHUB_RELEASE="$release"
compose() { docker compose --project-name creatorhub --env-file "$root/shared/frontend.env" -f "$compose_file" "$@"; }
compose config -q
# Refuse to create images under an existing tag.
for name in backend frontend; do
  if docker image inspect "creatorhub-$name:$release" >/dev/null 2>&1; then fail 'Release image already exists.'; fi
done
# Capture the actual prior images, including manually deployed releases.
previous="$release_dir/previous-images.yaml"
printf 'services:\n' > "$previous"
rollback_available=true
for service in api worker frontend; do
  ids=$(docker ps -aq --filter label=com.docker.compose.project=creatorhub --filter "label=com.docker.compose.service=$service" --filter label=com.docker.compose.oneoff=False)
  [[ $ids =~ ^[a-f0-9]+$ ]] || fail "Expected one existing CreatorHub $service container."
  old_image=$(docker inspect --format '{{.Config.Image}}' "$ids")
  case "$service" in frontend) expected=creatorhub-frontend ;; *) expected=creatorhub-backend ;; esac
  [[ $old_image =~ ^${expected}:[a-zA-Z0-9_.-]+$ ]] || fail 'Unexpected prior image; review manually.'
  printf '  %s:\n    image: "%s"\n' "$service" "$old_image" >> "$previous"
  old_state=$(docker inspect --format '{{.State.Status}}' "$ids")
  [[ $old_state == running ]] || rollback_available=false
done
# Build sequentially. Existing containers remain untouched until both builds succeed.
docker build --target runtime -t "creatorhub-backend:$release" "$release_dir/backend"
# The installed Compose config supplies the allowlisted public frontend build arguments.
compose build frontend
switched=false
finish() {
  local result=$?
  trap - EXIT
  if (( result != 0 )) && [[ $switched == true ]]; then
    if [[ $rollback_available == true ]]; then
      printf 'Deployment failed. Attempting to restore previous CreatorHub images.\n' >&2
      if compose -f "$previous" up -d --no-build --pull never --wait --wait-timeout 180 api worker frontend; then
        printf 'Previous containers restored. Check public health before considering recovery complete.\n' >&2
      else
        printf 'ROLLBACK FAILED. Manual recovery required. Previous images: %s\n' "$previous" >&2
      fi
    else
      printf 'Previous services were not all running. Stopping this failed release for manual review.\n' >&2
      compose stop api worker frontend || true
    fi
  fi
  exit "$result"
}
trap finish EXIT
switched=true
compose up -d --no-build --pull never --wait --wait-timeout 180 api worker frontend
curl --fail --silent --show-error --max-time 15 https://api.creatorhub.site/health >/dev/null
curl --fail --silent --show-error --max-time 15 https://creatorhub.site/account/sign-in >/dev/null
printf '%s %s %s\n' "$release" "$backend_sha" "$frontend_sha" > "$state/current-release.tmp"
mv "$state/current-release.tmp" "$state/current-release"
printf 'CreatorHub deployed: %s\n' "$release"
