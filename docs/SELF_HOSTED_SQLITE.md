# Self-Hosted SQLite Realtime Sync

This guide adds a private, self-hosted online mode using SQLite instead of Firebase.

## Overview

The app supports two realtime backends:

- **Firebase**: Hosted Realtime Database
- **SQLite**: A self-hosted Node server that stores sessions in a local SQLite database and streams updates over Server-Sent Events

## Recommended: Single-Container Docker Compose

This repository includes a `Dockerfile` and `docker-compose.yml` that run:

- The built frontend
- The SQLite sync server
- A persistent SQLite database in a Docker volume

Start it with:

```bash
docker compose up --build
```

Then open:

```text
http://localhost:8787
```

The compose setup uses a named volume called `init-tracker-data`, so session data survives container restarts.
The bundled frontend is configured with `VITE_SQLITE_SYNC_URL=/`, so online mode talks to the same container that serves the app.

## Publish a Pullable Image

This repository now includes [`.github/workflows/docker-publish.yml`](../.github/workflows/docker-publish.yml), which publishes a container image to GitHub Container Registry at:

```text
ghcr.io/<owner>/<repo>
```

The workflow runs on:

- Pushes to `prod`
- Git tags like `v1.2.3`
- Manual runs from the GitHub Actions tab

### What you need to do

1. Push this workflow to GitHub
2. Make sure GitHub Actions is enabled for the repository
3. Push to `prod` or create a release tag such as `v1.0.0`
4. In GitHub Packages, make the published package public if you want unauthenticated `docker pull` access

### Pull and run the published image

```bash
docker pull ghcr.io/seroph386/init-tracker:latest
docker run -p 8787:8787 -v init-tracker-data:/app/data ghcr.io/seroph386/init-tracker:latest
```

The publish workflow builds a multi-arch manifest (`linux/amd64` and `linux/arm64`) so ARM hosts can pull `latest` and `sha-*` tags without a platform mismatch.

If you publish under a different GitHub `owner/repo`, replace `seroph386/init-tracker` with your own image path.

### Compose using the published SQLite image (no local build)

Keep runtime settings in an external env file:

`compose.sqlite.yml`

```yaml
services:
  init-tracker:
    image: ghcr.io/seroph386/init-tracker:latest
    ports:
      - "${INIT_TRACKER_PORT:-8787}:8787"
    env_file:
      - ./deploy/sqlite-runtime.env
    volumes:
      - init-tracker-data:/app/data
    restart: unless-stopped

volumes:
  init-tracker-data:
```

`deploy/sqlite-runtime.env` (create from `deploy/sqlite-runtime.env.example`)

```dotenv
SQLITE_SYNC_HOST=0.0.0.0
SQLITE_SYNC_PORT=8787
SQLITE_SYNC_DB_PATH=/app/data/initiative-tracker.sqlite
SQLITE_SYNC_STATIC_DIR=/app/dist
SQLITE_SYNC_STATIC_BASE_PATH=/
```

Run it with `docker compose -f compose.sqlite.yml up -d`.

### Firebase published image + compose

The publish workflow can also publish Firebase image tags (`latest-firebase`, `sha-...-firebase`) when Firebase secrets are configured in GitHub Actions.

`compose.firebase.yml`

```yaml
services:
  init-tracker:
    image: ${INIT_TRACKER_IMAGE:-ghcr.io/seroph386/init-tracker:latest-firebase}
    ports:
      - "${INIT_TRACKER_PORT:-8787}:8787"
    restart: unless-stopped
```

`deploy/firebase-compose.env` (create from `deploy/firebase-compose.env.example`)

```dotenv
INIT_TRACKER_IMAGE=ghcr.io/seroph386/init-tracker:latest-firebase
INIT_TRACKER_PORT=8787
```

Run it with `docker compose --env-file deploy/firebase-compose.env -f compose.firebase.yml up -d`.

Useful commands:

```bash
# Start in the background
docker compose up --build -d

# Stop the stack
docker compose down

# Stop and remove the SQLite volume too
docker compose down -v
```

## Manual Node Setup

If you do not want Docker, you can still run the SQLite sync server directly.

### 1. Configure the frontend

Add the SQLite sync server URL to your `.env` file:

```env
VITE_SQLITE_SYNC_URL=http://localhost:8787
```

If you are reverse-proxying the Node server behind the same host as the app, you can use:

```env
VITE_SQLITE_SYNC_URL=/api
```

If the app and SQLite sync API are served from the same origin and the API lives at the web root, use:

```env
VITE_SQLITE_SYNC_URL=/
```

If you are building for a path other than `/`, you can also set:

```env
VITE_APP_BASE_PATH=/init-tracker/
```

### 2. Build the frontend

```bash
pnpm build
```

### 3. Start the SQLite sync server

```bash
pnpm sqlite:server
```

Optional environment variables:

- `SQLITE_SYNC_PORT` - Defaults to `8787`
- `SQLITE_SYNC_HOST` - Defaults to `0.0.0.0`
- `SQLITE_SYNC_DB_PATH` - Defaults to `./data/initiative-tracker.sqlite`
- `SQLITE_SYNC_STATIC_DIR` - Optional folder to serve built frontend assets from the same process
- `SQLITE_SYNC_STATIC_BASE_PATH` - Optional frontend base path when serving built assets, defaults to `/`

Example:

```bash
VITE_SQLITE_SYNC_URL=http://localhost:8787 VITE_APP_BASE_PATH=/ pnpm build
SQLITE_SYNC_DB_PATH=./data/private-table.sqlite SQLITE_SYNC_STATIC_DIR=./dist SQLITE_SYNC_STATIC_BASE_PATH=/ pnpm sqlite:server
```

## Use It In The App

1. Open the DM view
2. Open **Settings**
3. Choose **SQLite** as the online provider
4. Toggle **Online Mode**
5. Share the copied player or on-deck URLs

The generated URLs include `backend=sqlite`, so player clients connect to the same backend explicitly.

## Notes

- SQLite online sessions are still backed up to the DM's localStorage for offline recovery
- The default server allows anyone with the session URL to read and write that session, similar to the current Firebase mode
- For private deployments, place the Node server behind your own firewall, VPN, reverse proxy, or auth layer if you need stronger access control
