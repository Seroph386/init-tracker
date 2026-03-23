# Online Mode Setup Guide

This guide explains how to run Initiative Tracker's online mode using the built-in Node.js server and a self-hosted SQLite database.

## Overview

The initiative tracker now supports two storage modes:

- **Offline Mode (Default)**: All data is stored in browser localStorage.
- **Online Mode**: Combat state is stored in a SQLite database hosted by the app's own Node.js server and streamed to connected players in real time.

## What Changed

Online mode no longer depends on Firebase or any third-party hosted database. Instead, the repository includes:

- a built-in HTTP API server at `server/index.js`
- a SQLite session store saved to `.data/sessions.sqlite`
- server-sent event (SSE) streaming for live player updates
- standard `sqlite3` CLI access instead of the experimental `node:sqlite` module

That means you can deploy the app and the online session backend together on the same host while staying compatible with newer Node releases, including Node 24+.

## Prerequisites

- Node.js 20 or newer
- pnpm 10 or newer
- `sqlite3` installed on the server or local machine

## Local Development

1. Install dependencies:

```bash
pnpm install
```

2. Start the SQLite/API server in one terminal:

```bash
pnpm dev:api
```

3. Start the Vite frontend in another terminal:

```bash
pnpm dev
```

4. Open the frontend at `http://localhost:5173`

During development, Vite proxies `/api/*` requests to the Node server running on port `8787`.

## Production Hosting

1. Build the frontend:

```bash
pnpm build
```

2. Start the hosted app server:

```bash
pnpm start
```

3. Open the app at `http://localhost:8787`

The production server will:

- serve the built frontend from `dist/`
- expose the online-mode API under `/api/*`
- persist shared sessions in `.data/sessions.sqlite` via the host `sqlite3` binary

## Using Online Mode

### For the DM

1. Open the tracker in DM view.
2. Turn on **Online Mode** in Settings.
3. The app creates a session URL such as `?session=abc12345`.
4. Click **Copy Player URL** or **Copy Player Simple URL**.
5. Share the link with your players.

### For Players

1. Open the URL shared by the DM.
2. The view stays read-only.
3. Updates stream automatically as the DM changes combat.

## Database Storage

Shared sessions are stored in:

```text
.data/sessions.sqlite
```

You can back up or move this file with the rest of your app deployment if you want to preserve sessions between deploys.

## Deployment Notes

This online mode works best on platforms that can run a long-lived Node.js process and write to local disk or mounted storage, such as:

- a VPS
- Docker on your own server
- Fly.io / Render / Railway / similar Node hosts
- a home server or NAS

Pure static hosts such as GitHub Pages can still serve the offline app, but they cannot run the SQLite-backed online mode.

## Troubleshooting

### Online mode toggle does not sync

- Make sure the Node server is running.
- Confirm `/api/health` returns JSON from the same host as the frontend.
- In development, make sure `pnpm dev:api` is running before opening the UI.

### Players do not see updates

- Confirm both DM and players are using the same `?session=...` URL.
- Check server logs for API errors.
- Verify the `.data/sessions.sqlite` file is writable by the app process.

### Production server returns an asset error

- Run `pnpm build` before `pnpm start`.
- Make sure the `dist/` directory exists on the server.

## Security Notes

The current server keeps the same trust model as the old Firebase version:

- anyone with a session URL can read that session
- any client that can issue API writes can modify that session
- DM/player separation is still enforced in the frontend via local browser state

For private home games, this is usually acceptable. If you want stricter protection, likely next steps are:

1. DM auth tokens for write access
2. read-only player tokens
3. session expiration or cleanup
4. optional password-protected sessions
