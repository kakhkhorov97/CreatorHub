#!/bin/bash
set -euo pipefail

usage() {
  cat <<'HELP'
Usage: creatorhub COMMAND
  pull                    Fast-forward both develop checkouts
  build                   Build both images and remember the release
  deploy                  Start the remembered release and check health
  status                  Show container state, health and image
  health                  Check the public HTTPS website and API
  logs api|worker|frontend Show the latest 100 log lines
  logs SERVICE --follow   Follow logs until Ctrl+C
  start                   Resume the existing three containers
  stop                    Stop the three containers, allowing 30 seconds

Start uses the existing images and settings. It does not deploy pulled code.
HELP
}

fail() { printf '%s\n' "$*" >&2; exit 1; }

docker_cmd() {
  if [[ $EUID -eq 0 ]]; then
    docker "$@"
  else
    sudo docker "$@"
  fi
}

container_id() {
  local service=$1 id
  id=$(docker_cmd ps --all --quiet --no-trunc \
    --filter 'label=com.docker.compose.project=creatorhub' \
    --filter "label=com.docker.compose.service=$service" \
    --filter 'label=com.docker.compose.oneoff=False') || return
  if [[ -z $id ]]; then
    printf 'No CreatorHub %s container exists.\n' "$service" >&2
    return 1
  fi
  if [[ ! $id =~ ^[a-f0-9]{12,64}$ ]]; then
    printf 'Expected exactly one CreatorHub %s container; refusing this action.\n' "$service" >&2
    return 1
  fi
  printf '%s\n' "$id"
}

status() {
  local service id result=0
  printf 'SERVICE\tSTATE\tHEALTH\tIMAGE\n'
  for service in api worker frontend; do
    if id=$(container_id "$service"); then
      printf '%s\t' "$service"
      docker_cmd inspect --format '{{.State.Status}}{{printf "\t"}}{{if eq .State.Status "running"}}{{if .State.Health}}{{.State.Health.Status}}{{else}}not configured{{end}}{{else}}not running{{end}}{{printf "\t"}}{{.Config.Image}}' "$id" || result=1
    else
      printf '%s\tmissing\tunknown\t-\n' "$service"
      result=1
    fi
  done
  return "$result"
}

health() {
  local url code result=0
  for url in https://creatorhub.site/account/sign-in https://api.creatorhub.site/health; do
    if code=$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
      --connect-timeout 5 --max-time 10 "$url"); then
      if [[ $code == 200 ]]; then
        printf 'OK     HTTP %s  %s\n' "$code" "$url"
      else
        printf 'FAILED HTTP %s  %s\n' "$code" "$url"
        result=1
      fi
    else
      printf 'FAILED Connection or TLS error  %s\n' "$url"
      result=1
    fi
  done
  return "$result"
}

# Manual VPS workflow. Production credentials stay in shared/*.env.
project_root=/srv/Sean/creatorhub
state_dir="${HOME}/.local/state/creatorhub-cli"

release_setup() {
  [[ $EUID -ne 0 ]] || fail 'Run these shortcuts as sean, without sudo. Docker will request sudo itself.'
  [[ $(id -un) == sean ]] || fail 'Use the sean VPS account for release shortcuts.'
  command -v flock >/dev/null || fail 'flock is required on the Linux VPS.'
  umask 077
  mkdir -p "$state_dir"
  exec 9>"$state_dir/lock"
  flock -n 9 || fail 'Another CreatorHub pull/build/deploy is running.'
  backend="$project_root/backend"
  frontend="$project_root/frontend"
  for repo in "$backend" "$frontend"; do
    [[ $(git -C "$repo" branch --show-current) == develop ]] || fail "$repo must be on develop."
    [[ -z $(git -C "$repo" status --porcelain) ]] || fail "$repo has local changes; commit or review them first."
  done
  [[ $(git -C "$backend" remote get-url origin) == https://github.com/kakhkhorov97/CreatorHub.git ]] || fail 'Unexpected backend origin.'
  [[ $(git -C "$frontend" remote get-url origin) == https://github.com/kakhkhorov97/CreatorHub-next.git ]] || fail 'Unexpected frontend origin.'
}

compose_release() {
  sudo env CREATORHUB_ROOT="$project_root" CREATORHUB_FRONTEND_CONTEXT="$frontend" \
    CREATORHUB_RELEASE="$release" docker compose --project-name creatorhub \
    --env-file "$project_root/shared/frontend.env" -f "$backend/deploy/docker/compose.yaml" "$@"
}

release_fingerprint() {
  # Hash configuration without displaying any environment values.
  sudo sha256sum "$project_root/shared/frontend.env" "$project_root/shared/backend.env" \
    "$backend/deploy/docker/compose.yaml" | sha256sum | cut -d ' ' -f 1
}

pull_release() {
  release_setup
  # Validate both fast-forwards before moving either checkout.
  for repo in "$backend" "$frontend"; do
    git -C "$repo" fetch origin develop
    git -C "$repo" merge-base --is-ancestor HEAD FETCH_HEAD || fail "$repo cannot fast-forward; resolve manually."
  done
  for repo in "$backend" "$frontend"; do
    git -C "$repo" merge --ff-only FETCH_HEAD
    git -C "$repo" log -1 --oneline
  done
  printf 'Code pulled. Run creatorhub build next. Running containers were not changed.\n'
}

build_release() {
  release_setup
  sudo -v
  backend_sha=$(git -C "$backend" rev-parse HEAD)
  frontend_sha=$(git -C "$frontend" rev-parse HEAD)
  release="release-$(date -u +%Y%m%d-%H%M%S)-${backend_sha:0:12}-${frontend_sha:0:12}"
  fingerprint=$(release_fingerprint)
  # A failed new build must never leave an older candidate ready for deployment.
  rm -f "$state_dir/pending-release"
  for image in creatorhub-backend creatorhub-frontend; do
    if docker_cmd image inspect "$image:$release" >/dev/null 2>&1; then
      fail 'Release tag already exists; retry with a new timestamp.'
    fi
  done
  compose_release config -q
  compose_release build api
  compose_release build frontend
  [[ $(git -C "$backend" rev-parse HEAD) == "$backend_sha" && $(git -C "$frontend" rev-parse HEAD) == "$frontend_sha" ]] || fail 'Code changed during build. Build again.'
  for repo in "$backend" "$frontend"; do
    [[ -z $(git -C "$repo" status --porcelain) ]] || fail 'Working files changed during build. Build again.'
  done
  [[ $(release_fingerprint) == "$fingerprint" ]] || fail 'Configuration changed during build. Build again.'
  for image in creatorhub-backend creatorhub-frontend; do
    docker_cmd image inspect "$image:$release" >/dev/null
  done
  printf '%s\n%s\n%s\n%s\n' "$release" "$backend_sha" "$frontend_sha" "$fingerprint" > "$state_dir/pending-release.tmp"
  mv "$state_dir/pending-release.tmp" "$state_dir/pending-release"
  printf 'Built %s. Run creatorhub deploy, even from a new terminal.\n' "$release"
}

deploy_release() {
  release_setup
  [[ -f $state_dir/pending-release ]] || fail 'No completed build saved. Run creatorhub build first.'
  {
    IFS= read -r release
    IFS= read -r backend_sha
    IFS= read -r frontend_sha
    IFS= read -r fingerprint
  } < "$state_dir/pending-release"
  [[ $release =~ ^release-[0-9]{8}-[0-9]{6}-[a-f0-9]{12}-[a-f0-9]{12}$ ]] || fail 'Invalid saved release.'
  [[ $backend_sha =~ ^[a-f0-9]{40}$ && $frontend_sha =~ ^[a-f0-9]{40}$ && $fingerprint =~ ^[a-f0-9]{64}$ ]] || fail 'Invalid saved build metadata.'
  [[ $(git -C "$backend" rev-parse HEAD) == "$backend_sha" && $(git -C "$frontend" rev-parse HEAD) == "$frontend_sha" ]] || fail 'Code changed since build. Run creatorhub build again.'
  sudo -v
  [[ $(release_fingerprint) == "$fingerprint" ]] || fail 'Configuration changed since build. Run creatorhub build again.'
  for image in creatorhub-backend creatorhub-frontend; do
    docker_cmd image inspect "$image:$release" >/dev/null || fail 'A built image is missing. Build again.'
  done
  for service in api worker frontend; do container_id "$service" >/dev/null; done
  compose_release config -q
  if ! compose_release up -d --no-build --pull never --wait --wait-timeout 180 api worker frontend; then
    printf 'Deployment failed health checks. Inspect creatorhub status and creatorhub logs; no automatic rollback was performed.\n' >&2
    return 1
  fi
  status
  health
  cp "$state_dir/pending-release" "$state_dir/last-deployed"
  printf 'Deployed %s.\n' "$release"
}

command=${1:-help}
case "$command" in
  help|--help|-h) usage ;;
  pull|build|deploy)
    [[ $# -eq 1 ]] || fail 'This command takes no additional arguments.'
    "${command}_release"
    ;;
  status|health)
    [[ $# -eq 1 ]] || fail 'This command takes no additional arguments.'
    "$command"
    ;;
  start|stop)
    [[ $# -eq 1 ]] || fail 'This command takes no additional arguments.'
    ids=()
    for service in api worker frontend; do
      ids+=("$(container_id "$service")")
    done
    if [[ $command == start ]]; then
      printf 'Resuming existing CreatorHub containers. This does not deploy pulled code.\n'
      docker_cmd start "${ids[@]}"
    else
      docker_cmd stop --timeout 30 "${ids[@]}"
    fi
    status
    ;;
  logs)
    [[ $# -eq 2 || $# -eq 3 ]] || fail 'Use: creatorhub logs api|worker|frontend [--follow]'
    case "$2" in api|worker|frontend) ;; *) fail 'Choose api, worker or frontend.' ;; esac
    options=(--tail 100 --timestamps)
    if [[ $# -eq 3 ]]; then
      [[ $3 == --follow ]] || fail 'The only log option is --follow.'
      options+=(--follow)
    fi
    id=$(container_id "$2")
    docker_cmd logs "${options[@]}" "$id"
    ;;
  *) usage >&2; exit 2 ;;
esac
