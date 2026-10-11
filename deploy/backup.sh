#!/usr/bin/env bash
set -euo pipefail
# Brief maintenance window for only CreatorHub's database writers.
active=()
for service in creatorhub-api.service creatorhub-worker.service; do
    if systemctl is-active --quiet "$service"; then active+=("$service"); fi
done
resume() {
    status=$?
    trap - EXIT
    if (( ${#active[@]} )); then systemctl start "${active[@]}" || status=1; fi
    exit "$status"
}
trap resume EXIT
systemctl stop creatorhub-api.service creatorhub-worker.service
umask 077
/usr/bin/node /srv/Sean/creatorhub/current/backend/deploy/backup.cjs
