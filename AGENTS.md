# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Repository Identity

- **Repository**: `Seroph386/init-tracker`
- **Maintainer**: `Seroph386`
- **Origin**: This codebase is a divergent rework of [Valforte/initiative-tracker](https://github.com/Valforte/initiative-tracker). Credit Gabriel Valforte for the original project, but treat this repository's current code, docs, and roadmap as the source of truth for changes.

## Project Overview

A Vue 3 + TypeScript initiative tracker for tabletop RPG combat, specifically designed for Pathfinder 2e. The application manages combatant tracking with HP, initiative order, conditions, and separate views for DMs and players.

## Tech Stack

- **Vue 3** with `<script setup>` single-file components
- **TypeScript** in strict mode
- **Vite** for build tooling
- **Tailwind CSS** (v4) with DaisyUI for styling
- **Reka UI** for advanced components
- **VueUse** for localStorage persistence
- **Iconify** for icons

## Development Commands

```bash
# Development server
pnpm dev

# Type-check and build
pnpm build

# Preview production build
pnpm preview

# Run tests
pnpm test

# Type-check only
pnpm run type-check

# Start the SQLite sync server
pnpm sqlite:server
```

## Build Configuration

- Build output directory is `./dist`
- `vue-tsc` runs before production builds
- GitHub Pages deployments use the `/init-tracker/` base path configured in `vite.config.ts`

## Architecture

### State Management

State is persisted with VueUse's `useStorage` composable across:

- `combatants`: array of combatants with custom serialization
- `turn`: current turn index
- `round`: current round number
- `lang`: selected language (`en` / `pt_BR`)
- `theme`: DaisyUI theme selection

### Core Data Models

Defined in `src/functions.ts`:

- **Combatant**: main entity tracking name, HP, initiative, conditions, and visibility
- **Condition**: status effects with name, value, and auto-generated color
- **Visibility**: enum controlling player view visibility (`None`, `Half`, `Full`)

### Component Structure

- **App.vue**: root component with theme and language selectors
- **InitiativeManager.vue**: state container that routes to DM, player, or on-deck views
- **DMView.vue**: full DM interface
- **DMTable.vue**: combat table with HP and condition controls
- **PlayerView.vue**: standard read-only player interface
- **PlayerSimpleView.vue**: on-deck presentation mode
- **PlayerTable.vue**: player-facing initiative table

### Large Data Files

- `src/db.ts` contains large static arrays for monsters and condition definitions
- `src/lang.ts` contains all localizable user-facing strings

## Agent Working Notes

- Treat `package.json`, `README.md`, and the docs in `docs/` as the canonical public-facing metadata for this repo.
- Keep repository identity consistent with `init-tracker`, `Seroph386`, and `https://github.com/Seroph386/init-tracker.git`.
- Preserve attribution to Gabriel Valforte when touching repository-history or origin-related documentation.
- Localize all new user-facing text in both English and Brazilian Portuguese via `src/lang.ts`.
- When editing combatant logic, account for custom localStorage serialization and visibility-driven turn behavior.
- Prefer minimal, targeted changes over broad refactors unless the task explicitly calls for them.

## Related Guidance

- `docs/CLAUDE.md` contains the existing Claude-specific guidance that this file is based on.
