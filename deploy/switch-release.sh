#!/usr/bin/env bash
# Switch only the paired CreatorHub release. Never restart Nginx or other apps.
set -euo pipefail
root="${CREATORHUB_ROOT:-/srv/Sean/creatorhub}"
release="${1:-}"
[[ "$release" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$ ]] || { echo 'Pass one release ID.' >&2; exit 2; }
[[ "$release" != *..* ]] || exit 2
root="$(realpath "$root")"
target="$root/releases/$release"
[[ "$(realpath "$target")" == "$target" ]] || { echo 'Release path must be a real directory.' >&2; exit 2; }
for file in backend/dist/apps/Creator-api/main.js backend/dist/apps/Creator-batch/main.js frontend/.next/BUILD_ID; do
    [[ -f "$target/$file" ]] || { echo "Incomplete release: $file" >&2; exit 2; }
done
previous=''
[[ ! -e "$root/current" || -L "$root/current" ]] || { echo 'current must be a symlink.' >&2; exit 2; }
if [[ -L "$root/current" ]]; then
    previous="$(readlink -f "$root/current")"
    [[ "$previous" == "$root/releases/"* && -d "$previous" ]] || exit 2
fi
[[ "$previous" != "$target" ]] || { echo 'Release is already current.'; exit 0; }
services=(creatorhub-api.service creatorhub-worker.service creatorhub-frontend.service)
switch_to() {
    local next="$1"
    local link="$root/.current-$$"
    ln -s "$next" "$link"
    mv -Tf "$link" "$root/current"
}
probe() {
    for attempt in {1..20}; do
        if curl --fail --silent --max-time 4 http://127.0.0.1:7001/health >/dev/null &&
           curl --fail --silent --max-time 4 http://127.0.0.1:7002/ >/dev/null &&
           curl --fail --silent --max-time 4 http://127.0.0.1:7007/account/sign-in >/dev/null; then return 0; fi
        sleep 2
    done
    return 1
}
changed=0
rollback() {
    status=$?
    trap - EXIT
    if (( status != 0 && changed == 1 )); then
        systemctl stop "${services[@]}" || true
        if [[ -n "$previous" ]]; then
            switch_to "$previous"
            systemctl start "${services[@]}" || true
            if probe; then echo 'Previous CreatorHub release restored.' >&2;
            else echo 'Previous release did not recover. Inspect CreatorHub journals.' >&2; fi
        else
            rm -f "$root/current"
            echo 'First release failed; CreatorHub services left stopped.' >&2
        fi
    fi
    exit "$status"
}
trap rollback EXIT
changed=1
systemctl stop "${services[@]}"
switch_to "$target"
systemctl start "${services[@]}"
probe || { echo 'CreatorHub readiness checks failed.' >&2; exit 1; }
if [[ -n "$previous" ]]; then printf '%s\n' "$previous" > "$root/shared/previous-release"; fi
echo "CreatorHub release $release is ready."
