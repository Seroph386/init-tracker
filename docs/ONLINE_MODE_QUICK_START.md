# Online Mode - Quick Start

This guide gets you running with self-hosted online mode in a few minutes.

## 1. Install dependencies

```bash
pnpm install
```

## 2. Start the backend

In terminal one:

```bash
pnpm dev:api
```

## 3. Start the frontend

In terminal two:

```bash
pnpm dev
```

## 4. Open the app

Visit:

```text
http://localhost:5173
```

## 5. Share a session

### DM
1. Open Settings.
2. Toggle **Online Mode** on.
3. Copy the player URL.
4. Send it to your group.

### Players
1. Open the shared link.
2. Watch updates arrive in real time.

## Production

To host the frontend and SQLite database together:

```bash
pnpm build
pnpm start
```

The app will be served from `http://localhost:8787` by default.

## Where session data lives

```text
.data/sessions.sqlite
```

## Need more detail?

See [ONLINE_MODE_SETUP.md](./ONLINE_MODE_SETUP.md) for deployment notes, storage details, and troubleshooting.
