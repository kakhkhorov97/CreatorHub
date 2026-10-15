#!/bin/bash
# Root-owned forced SSH command. Never evaluate SSH_ORIGINAL_COMMAND as shell code.
set -euo pipefail
if [[ ${SSH_ORIGINAL_COMMAND:-} =~ ^deploy\ ([0-9a-f]{40})\ ([0-9a-f]{40})$ ]]; then
  exec sudo -n /usr/local/sbin/creatorhub-deploy "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
fi
printf 'Only deploy followed by two full commit SHAs is allowed.\n' >&2
exit 1
