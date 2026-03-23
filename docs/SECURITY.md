# Security Features

This document explains the current security model for online multiplayer mode.

## Current Model

Online sessions are shared through a built-in Node.js API backed by SQLite. The frontend still uses the same DM/player browser-based separation that existed before the Firebase removal.

## Player Security

### 1. Session-Based Access Control

**Problem**: Players could try to switch into DM view and reveal hidden combatants.

**Solution**:
- Each DM-created session ID is stored in browser localStorage under `dmSessions`.
- If a browser opens a shared `?session=...` link and does not have that session in `dmSessions`, the app forces player view.
- Shared links remain read-only in the UI.

### 2. URL Manipulation Protection

**Problem**: A player could remove `?view=player` from the URL.

**Solution**:
- The app watches the URL.
- If the browser is not recognized as the DM for that session, the player view parameter is restored automatically.

### 3. LocalStorage Isolation

**Problem**: Shared session data should not leak into player localStorage.

**Solution**:
- Players load shared data from the hosted session API only.
- DMs keep a localStorage backup for recovery.
- Shared player sessions do not write combat state into localStorage.

## DM Benefits

### 1. Offline Backup

While online mode is enabled, the DM browser still keeps local copies of:
- `turn`
- `round`
- `combatants`

That makes it possible to fall back to offline mode if the hosted service becomes unavailable.

### 2. Self-Hosted Persistence

Shared state is stored in the app's own SQLite database:

```text
.data/sessions.sqlite
```

This means the app and its online session data can be deployed together.

## Online Session Flow

### Creating an Online Session

1. The DM enables **Online Mode**.
2. The app generates a unique session ID.
3. The session ID is stored in the DM browser's `dmSessions` list.
4. The URL is updated with `?session=...`.
5. Combat state is synced to the hosted API and persisted in SQLite.

### Joining as a Player

1. A player opens the shared link with `?session=...&view=player`.
2. The browser checks `dmSessions`.
3. If the session is not present locally, the browser is treated as a player.
4. Data is loaded from the hosted API without DM controls.

## Limitations

### 1. Browser-Scoped DM Access

DM access is tied to the browser that created the session. If a DM creates a session in one browser and opens it in another, the second browser will not automatically be recognized as the DM.

### 2. Shared URL Trust Model

Right now, anyone with the session URL can read that session, and a determined client could also write to the backing API. The UI protects normal player usage, but there is not yet a server-side auth layer.

### 3. Shared Device Edge Cases

If DM and player use the same browser profile, local session ownership can overlap. Separate devices or private browsing are still recommended for testing.

## Recommended Future Hardening

If you want stronger production security, likely next steps are:

1. add DM write tokens
2. issue read-only player tokens
3. expire or clean up sessions automatically
4. add optional password protection
5. move audit logic to the server side
