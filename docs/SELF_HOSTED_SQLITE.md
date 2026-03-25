# Self-Hosted SQLite Realtime Sync

This guide adds a private, self-hosted online mode using SQLite instead of Firebase.

## Overview

The app now supports two realtime backends:

- **Firebase**: Hosted Realtime Database
- **SQLite**: A self-hosted Node server that stores sessions in a local SQLite database and streams updates over Server-Sent Events

## 1. Configure the frontend

Add the SQLite sync server URL to your `.env` file:

```env
VITE_SQLITE_SYNC_URL=http://localhost:8787
```

If you are reverse-proxying the Node server behind the same host as the app, you can use:

```env
VITE_SQLITE_SYNC_URL=/api
```

## 2. Start the SQLite sync server

Run:

```bash
pnpm sqlite:server
```

Optional environment variables:

- `SQLITE_SYNC_PORT` - Defaults to `8787`
- `SQLITE_SYNC_HOST` - Defaults to `0.0.0.0`
- `SQLITE_SYNC_DB_PATH` - Defaults to `./data/initiative-tracker.sqlite`
- `SQLITE_SYNC_STATIC_DIR` - Optional folder to serve built frontend assets from the same process

Example:

```bash
SQLITE_SYNC_DB_PATH=./data/private-table.sqlite SQLITE_SYNC_STATIC_DIR=./docs pnpm sqlite:server
```

## 3. Build and serve the app

Build the frontend:

```bash
pnpm build
```

Then either:

- Serve `./docs` with your web server and run the SQLite sync server separately
- Or point `SQLITE_SYNC_STATIC_DIR=./docs` and let the Node server serve the built app too

## 4. Use it in the app

1. Open the DM view
2. Open **Settings**
3. Choose **SQLite** as the online provider
4. Toggle **Online Mode**
5. Share the copied player/on-deck URLs

The generated URLs include `backend=sqlite`, so player clients connect to the same backend explicitly.

## Notes

- SQLite online sessions are still backed up to the DM's localStorage for offline recovery
- The default server allows anyone with the session URL to read and write that session, similar to the current Firebase mode
- For private deployments, place the Node server behind your own firewall, VPN, reverse proxy, or auth layer if you need stronger access control
