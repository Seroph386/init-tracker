# Quick Start Guide

## First Time Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Run development server
pnpm dev

# 3. Open browser to http://localhost:5173
```

## Daily Development

```bash
# Make sure you're on main
git checkout main

# Make changes to code...

# Test before committing
pnpm test
pnpm run type-check

# Commit and push
git add .
git commit -m "feat: your change description"
git push origin main
```

**GitHub Actions will automatically**:
- ✅ Run tests
- ✅ Check types
- ✅ Try to build

Check the ✅ or ❌ on GitHub while the deploy workflow runs.

**GitHub Actions will automatically**:
- 🏗️ Build the site
- 🚀 Deploy to GitHub Pages
- 🌐 Live in ~2 minutes at: https://seroph386.github.io/init-tracker/

## Available Commands

```bash
pnpm dev            # Start dev server
pnpm build          # Build for production
pnpm preview        # Preview production build locally
pnpm test           # Run tests once
pnpm test:watch     # Run tests in watch mode
pnpm test:ui        # Open test UI
pnpm run type-check # Check TypeScript types
```

## Branch Strategy

- **`main`**: Development branch and GitHub Pages deploy source

## Need More Info?

- **Full workflow explanation**: See `GIT_WORKFLOW.md`
- **GitHub setup**: See `GITHUB_SETUP.md`
- **Contributing**: See `CONTRIBUTING.md`
- **Changelog**: See `CHANGELOG.md`

## Troubleshooting

**Tests failing?**
```bash
pnpm test:watch  # Run in watch mode to see what's failing
```

**Type errors?**
```bash
pnpm run type-check  # See all type errors
```

**Build failing?**
```bash
pnpm build  # Try building locally first
```

**Site not updating after deploy?**
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Wait 2-3 minutes for GitHub Pages CDN
- Check `Settings -> Pages` is using the GitHub Actions workflow, not branch file serving

## Getting Help

1. Check `GIT_WORKFLOW.md` for detailed explanations
2. Check GitHub Actions tab for error details
3. Open an issue with:
   - What you tried
   - What happened
   - Error messages
   - Link to failed Action (if applicable)
