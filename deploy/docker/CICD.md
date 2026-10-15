# GitHub checks and manual deployment

CI runs on pushes to develop/main and on pull requests in both repositories. The backend repository also owns **Deploy CreatorHub**, a manual workflow. It selects a backend/frontend commit pair from develop, tests and builds both on a GitHub-hosted runner, then invokes a restricted SSH command. A push does not deploy automatically.

## Scope and limitations

The deployment user is `creatorhub-deploy`. Its SSH key can invoke only the installed deployment helper with two full lowercase commit SHAs. The helper targets Compose project `creatorhub`, services `api`, `worker`, `frontend`, and localhost ports 7001, 7002, 7007. Production env files and uploads remain under `/srv/Sean/creatorhub/shared`. Nginx, certificates, Danny's services, and the existing `sean` account are not changed.

Source snapshots are stored under `/var/lib/creatorhub-deploy/releases`, not pulled over the editable backend/frontend checkout. Each release uses new local Docker image tags. Your existing `creatorhub status`, `health`, `logs`, `start`, and `stop` commands still work. `start` resumes existing containers; the GitHub workflow deploys new code. The normal checkout can therefore be behind the deployed snapshots. Check `/var/lib/creatorhub-deploy/current-release` with sudo for the actual pair.

Docker access is privileged. Restricting the SSH command reduces accidental misuse; it does not make arbitrary code approved for deployment safe. Protect both develop branches and the production environment. Do not give this key a general sudo rule or Docker group membership. Keep the installed helper and Compose file root-owned. Updating them requires a separate reviewed installation.

Builds on the VPS are sequential but still use CPU, memory, and disk shared with friends. Replacing containers can cause a brief interruption. This is not blue-green deployment. No database migration, backup, cleanup, or restart of shared services is performed. Retained images and source snapshots consume disk; monitor space and review cleanup manually. Image rollback cannot reverse database changes or external effects.

Both repositories must remain publicly readable for this initial setup. Private repositories require a separately scoped read credential design; do not insert personal tokens into repository URLs. Backend tests use disposable MongoDB instances, not production Atlas. Public HTTPS health checks do not verify every application feature.

## 1. Publish and inspect CI

Commit only the intended files in each repository and push them. Do not accidentally include another contributor's unfinished application edits. The deployment workflow must also exist on the backend repository's default branch for GitHub to show **Run workflow**. If develop is not the default branch, merge the workflow through the normal review process; do not change the default branch solely for this feature.

Confirm **Backend checks** and **Frontend checks** pass in GitHub Actions. The manual deployment repeats checks on the selected pair and will not deploy if they fail. CI installs Node 22 and uses the existing lockfiles. It needs no production secrets.

## 2. Install the VPS helper once, manually as sean

Review these three files before installing:
- `deploy-release.sh`
- `deploy-ssh.sh`
- `compose.yaml`

The following commands create a dedicated account, copy root-owned helpers/configuration, and allow that account to run only the deployment helper through sudo. They do not deploy or restart anything. Coordinate this new privileged deployment access with the shared-server administrators before applying it.

```bash
cd /srv/Sean/creatorhub/backend
sudo adduser --disabled-password --gecos '' creatorhub-deploy
sudo install -d -o root -g root -m 0755 /etc/creatorhub-deploy
sudo install -d -o root -g root -m 0700 /var/lib/creatorhub-deploy
sudo install -o root -g root -m 0755 deploy/docker/deploy-release.sh /usr/local/sbin/creatorhub-deploy
sudo install -o root -g root -m 0755 deploy/docker/deploy-ssh.sh /usr/local/bin/creatorhub-deploy-ssh
sudo install -o root -g root -m 0600 deploy/docker/compose.yaml /etc/creatorhub-deploy/compose.yaml
sudo visudo -f /etc/sudoers.d/creatorhub-deploy
```

In that new sudoers file, enter only:

```text
creatorhub-deploy ALL=(root) NOPASSWD: /usr/local/sbin/creatorhub-deploy
```

Save and validate with `sudo visudo -c`. The helper itself rejects missing, extra, or malformed arguments. Do not add `NOPASSWD: ALL`.

Verify prerequisites without printing secrets:

```bash
command -v git tar flock curl docker
sudo docker compose version
sudo test -f /srv/Sean/creatorhub/shared/backend.env
sudo test -f /srv/Sean/creatorhub/shared/frontend.env
creatorhub status
```

The helper requires exactly one existing container for each service, including stopped containers, and a Compose version supporting `up --wait --wait-timeout`. This flow updates an existing deployment; it is not a first-install script.

## 3. Create a dedicated SSH key on your Mac

Use a new filename so an existing key is never overwritten:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/creatorhub-actions -C creatorhub-github-actions
```

For unattended Actions use, leave this dedicated key's passphrase empty. Keep the private file private and do not paste it into chat, Git, or a terminal command. The `.pub` file is the public key to install on the VPS.

On the VPS, create a root-controlled key directory and edit the authorization file:

```bash
sudo install -d -o root -g root -m 0755 /home/creatorhub-deploy/.ssh
sudo touch /home/creatorhub-deploy/.ssh/authorized_keys
sudo chown root:root /home/creatorhub-deploy/.ssh/authorized_keys
sudo chmod 0644 /home/creatorhub-deploy/.ssh/authorized_keys
sudo nano /home/creatorhub-deploy/.ssh/authorized_keys
```

Add one line, replacing the public-key placeholder with the entire contents of `creatorhub-actions.pub`:

```text
restrict,command="/usr/local/bin/creatorhub-deploy-ssh" ssh-ed25519 YOUR_PUBLIC_KEY creatorhub-github-actions
```

This key must not be added without the `restrict` and forced-command options. They disable forwarding/PTY and route every SSH invocation through validation. Use the VPS console to verify the host public key and fingerprint:

```bash
sudo cat /etc/ssh/ssh_host_ed25519_key.pub
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Construct the known-hosts entry as `179.197.240.195 ssh-ed25519 PUBLIC_HOST_KEY`, using the actual public host key shown by the trusted console. This is the server's host key, not your new deployment public key. Do not bypass host-key checking or blindly trust a fresh network key scan.

## 4. Configure GitHub

In **kakhkhorov97/CreatorHub → Settings → Environments**, create `production`. Restrict deployment branches to the trusted branch from which you will run this workflow, normally develop. Add required reviewers if available for the repository/account. The explicit manual workflow trigger remains required regardless of reviewer support.

Add these environment secrets:

| Name | Value |
| --- | --- |
| CREATORHUB_DEPLOY_HOST | `179.197.240.195` |
| CREATORHUB_DEPLOY_KEY | Entire private key file `~/.ssh/creatorhub-actions` |
| CREATORHUB_KNOWN_HOSTS | Verified known-hosts entry constructed above |

Do not add database passwords, JWT secrets, Resend keys, or the server's private host key. App secrets stay in the existing VPS env files. Restrict who can edit workflows and run production deployments.

## 5. Deploy

Open **CreatorHub → Actions → Deploy CreatorHub → Run workflow**. Choose the trusted workflow branch. Leave both commit fields blank to select the current develop heads, or enter full 40-character lowercase commit SHAs from those branches. Checks display the selected pair in the workflow summary. Complete an environment approval if configured.

The server validates that both commits belong to develop, captures the previous image references, builds backend then frontend, and replaces only CreatorHub's three containers. It waits for container health and checks the public frontend/API HTTPS endpoints.

On failure after switching, it attempts to restore previous images if all three old containers were running. If the old deployment was stopped or partially stopped, it stops the failed new release and requests manual review. A failed deployment remains red even if restoration succeeds. Failures before switching leave existing containers untouched. The workflow lock and server lock prevent overlapping automated deployments; avoid manual Docker changes while a workflow is running.

After the first deployment, verify `creatorhub status`, `creatorhub health`, normal login, and Danny's site. A successful workflow alone does not test all application functionality.

## Rollback and recovery

Each release directory contains `previous-images.yaml`. Keep prior images and snapshots. For manual recovery, identify the failed release from the Actions log and review that file with sudo. Use the installed base Compose file plus that exact image override, the shared frontend env file, and the same CreatorHub environment variables. Do not use `docker compose down`, delete volumes, or prune Docker globally.

Automatic restoration uses the installed Compose file and current production environment files. It restores image versions, not historic configuration or database contents. Test a controlled failed deployment and recovery before relying on this mechanism.

## Local validation

```bash
bash -n deploy/docker/deploy-release.sh
bash -n deploy/docker/deploy-ssh.sh
node --test deploy/docker/*.test.cjs
```

The deployment tests mock Git, Docker, curl, sudo, and locking inside temporary directories. They verify validation, build failure, successful switching, rollback attempts, stopped-site behavior, and forced-command restrictions. They do not connect to the VPS or establish that GitHub credentials, Linux Docker, and live rollback work.
