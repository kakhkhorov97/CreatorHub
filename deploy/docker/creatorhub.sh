#!/bin/bash
set -euo pipefail

usage() {
  cat <<'HELP'
Usage: creatorhub COMMAND
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

command=${1:-help}
case "$command" in
  help|--help|-h) usage ;;
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
