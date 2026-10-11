# CreatorHub with Docker

This is the selected deployment method. The previous systemd application services and switch-release/backup/monitor scripts describe a different deployment method; do not install or run them for the Docker deployment. Keep the existing server Nginx and certificate configuration. Do not run both methods on the same ports.

## What Docker does

A Dockerfile describes how to build an image containing Node, dependencies and compiled application code. A container runs that image. Compose starts the API, worker and frontend together under the fixed project name creatorhub. Restart policies restart crashed containers. A failed health check marks a running container unhealthy; it does not itself restart it. Uploaded files live outside images so replacing a container preserves them. MongoDB stays in Atlas, in the dedicated creatorhub_prod database.

This Linux VPS configuration uses host networking, so Nginx reaches localhost ports 7001 and 7007 without changing the applications' loopback proxy trust. The worker uses localhost 7002. There is no ports mapping: containers share the host network, but application processes bind only to 127.0.0.1. Host networking does not isolate access to friends' local network services. Containers run as Node's non-root UID 1000, drop capabilities and cannot write the image filesystem. Keep credentials database-scoped. This Compose file is intended for the Linux VPS; Mac Docker Desktop needs host networking explicitly enabled.

## First check on the VPS

Run these read-only commands and review the output before installing anything:

```bash
cat /etc/os-release
command -v docker
docker --version
docker compose version
systemctl is-active docker containerd
sudo ss -ltnp
```

If Docker is absent, follow Docker's official Ubuntu apt-repository instructions after checking for existing containerd/runc or other friends' container workloads. Do not use the convenience installation script, remove packages blindly, reboot the VPS, or change global firewall rules. Docker installation starts a shared host service and can change firewall rules. Keep a record of the existing site's response and Nginx test result before installation. No Docker installation has been performed by Codex.

## Files on the VPS

```text
/srv/Sean/creatorhub/
  backend/                 backend repository including deploy/docker/compose.yaml
  frontend/                frontend repository
  shared/
    backend.env            private production settings
    frontend.env           private production settings
    uploads/               persistent public media
```

Both repositories now contain Dockerfile and .dockerignore. The build contexts allow source and required assets while excluding Git history, .env files, uploads, local records and node_modules. No private environment file is copied into an image. Public NEXT_PUBLIC values are supplied explicitly during the frontend build; private Gemini/provider credentials are passed only at runtime. Docker administrators can inspect container environment variables, so restrict Docker access to trusted administrators.

Fill the previously prepared production settings privately, rotate exposed keys, and keep both env files mode 600. The containers read their env through Docker, so root can own these files. Only the uploads directory needs UID/GID 1000 access. Before changing permissions, confirm it contains only CreatorHub uploads:

```bash
sudo chown -R 1000:1000 /srv/Sean/creatorhub/shared/uploads
sudo chmod 700 /srv/Sean/creatorhub/shared/uploads
```

The Compose environment overrides the upload location to /app/uploads and mounts that exact directory. Do not change ownership of friends' folders. Keep the public API and frontend domains in the env files; use HTTPS for callbacks.

## Build one release

Choose a new tag for each release. Keep a record of its two Git commit IDs. Run from the backend checkout:

```bash
cd /srv/Sean/creatorhub/backend
export CREATORHUB_ROOT=/srv/Sean/creatorhub
export CREATORHUB_FRONTEND_CONTEXT=/srv/Sean/creatorhub/frontend
export CREATORHUB_RELEASE=release-001
```

All following Compose commands use the same options. The frontend env file supplies allowlisted public build arguments as well as runtime settings. Validation uses -q to avoid printing credentials:

```bash
docker compose --env-file ../shared/frontend.env -f deploy/docker/compose.yaml config -q
docker compose --env-file ../shared/frontend.env -f deploy/docker/compose.yaml build api
docker compose --env-file ../shared/frontend.env -f deploy/docker/compose.yaml build frontend
```

Build sequentially to reduce memory pressure on the shared server. The API and worker use the same backend image. Do not reuse a release tag after building it. Images do not replace the host's Node installation.

## Start and inspect

Confirm ports 7001/7002/7007 remain free and production settings target creatorhub_prod. Then:

```bash
docker compose --env-file ../shared/frontend.env -f deploy/docker/compose.yaml up -d --no-build --pull never api worker frontend
docker compose --env-file ../shared/frontend.env -f deploy/docker/compose.yaml ps
docker compose --env-file ../shared/frontend.env -f deploy/docker/compose.yaml logs --tail=50 api worker frontend
curl --fail http://127.0.0.1:7001/health
curl --fail http://127.0.0.1:7002/
curl --fail --output /dev/null http://127.0.0.1:7007/account/sign-in
```

Install only the CreatorHub Nginx site using the HTTP/certificate/HTTPS steps in ../README.md. The proxy templates keep the same localhost ports. Always run nginx -t before reloading; leave hadijam and default untouched. Containers never bind ports 80 or 443.

## Database administration

The production indexes and initial categories have already been prepared. Build the optional administration image when needed:

```bash
docker compose --env-file ../shared/frontend.env -f deploy/docker/compose.yaml --profile tools build tools
```

After registering and verifying your owner account at the HTTPS website, promote it:

```bash
docker compose --env-file ../shared/frontend.env -f deploy/docker/compose.yaml --profile tools run --rm --no-deps tools npm run db:admin -- mitpractice1@gmail.com
```

The tools profile is never started by the normal up command. It uses the existing backend administration CLI; no password is generated or replaced.

## Stop, update and rollback

Use compose stop api worker frontend to stop only CreatorHub. Do not use docker stop with a list of every container, docker system prune, or compose down -v on this shared server.

For an update, build both images with a new CREATORHUB_RELEASE tag, then run the scoped up command. Verify health, HTTPS and friends' sites. If health or live checks fail, set CREATORHUB_RELEASE back to the previous tag and repeat up with --no-build --pull never. Keep the previous images. This is a manual rollback with a short interruption, not an automatic blue-green deployment. It does not roll back database writes. Rehearse before launch.

## Remaining launch checks

Docker is not installed locally, so these images have not been built or run by Codex. YAML parsing and static configuration checks do not replace docker compose config or a real image build. Test production credentials and APIs only with designated accounts.

Local dependency audits and compatibility checks passed; see [the security review](../SECURITY.md). Docker image builds and container runtime checks still need verification. Test live social callbacks, email action links, administrator approvals, cross-tab authentication and Socket.IO. Upload a file, recreate the API container, and verify it still loads. The old systemd backup and monitor scripts must not be used here: they do not manage or observe these containers. A Docker-aware backup/restore procedure and monitoring setup remain required before launch. Stop only API and worker for a consistent database-plus-uploads backup; resume them even if the backup fails. Keep off-server copies, and restore into a disposable database and folder. Configure external HTTPS uptime alerts, inspect Compose health and logs, and test alert delivery and manual rollback.

References: [Docker Ubuntu installation](https://docs.docker.com/engine/install/ubuntu/), [host networking](https://docs.docker.com/engine/network/drivers/host/), [Compose environment files](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/).
