# Git Workflow & GitHub Actions Explained

This document explains how your git branches and automated workflows are set up.

## Branch Strategy

Your repository uses a **main-branch deployment strategy**:

```
main (development + deployment)
```

### `main` branch
- **Purpose**: Active development
- **What happens here**:
  - Day-to-day coding
  - Feature development
  - Bug fixes
  - Pull requests from contributors
- Merged changes ready for users
- **Automated checks**: CI runs tests, type-check, and build, and the Pages deploy workflow publishes the site from `main`

---

## GitHub Actions Workflows

You have **2 automated workflows** that run on GitHub's servers:

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Triggers**: Runs on every push or pull request to `main`

**What it does**:
```
Step 1: Checkout code
   ↓ Downloads your code from GitHub

Step 2: Setup Node.js 20
   ↓ Installs Node.js on the GitHub server

Step 3: Setup pnpm
   ↓ Installs pnpm package manager

Step 4: Install dependencies (pnpm install)
   ↓ Downloads all your project dependencies (Vue, TypeScript, etc.)

Step 5: Run tests (pnpm test)
   ↓ Executes your unit tests - FAILS if any test fails

Step 6: Type check (pnpm run type-check)
   ↓ Checks TypeScript types - FAILS if any type errors

Step 7: Build (pnpm build)
   ↓ Builds production version - FAILS if build errors

✅ If all steps pass → Green checkmark on GitHub
❌ If any step fails → Red X on GitHub (and PR can't be merged)
```

**Purpose**: Ensures code quality. Prevents broken code from being merged.

### 2. Deploy Workflow (`.github/workflows/deploy.yml`)

**Triggers**: Runs when you push to `main`, or manually via `workflow_dispatch`

**What it does**:
```
BUILD JOB:
Step 1: Checkout code
   ↓ Downloads your code from GitHub

Step 2: Setup Node.js 20
   ↓ Installs Node.js

Step 3: Setup pnpm
   ↓ Installs pnpm

Step 4: Install dependencies
   ↓ Downloads all dependencies

Step 5: Build for production (pnpm build)
   ↓ Creates optimized production build in ./dist folder
   ↓ Uses VITE_APP_BASE_PATH=/init-tracker/ for GitHub Pages asset URLs

Step 6: Setup Pages
   ↓ Configures GitHub Pages settings

Step 7: Upload artifact
   ↓ Packages the ./dist folder for deployment
   ↓
   ↓ (waits for BUILD JOB to complete)
   ↓
DEPLOY JOB:
Step 8: Deploy to GitHub Pages
   ↓ Publishes the built files to your live site
   ↓
   🌐 Site is now live at: https://seroph386.github.io/init-tracker/
```

**Purpose**: Automatically deploys the latest `main` branch to GitHub Pages.

---

## Typical Development Workflow

### Daily Development

```bash
# 1. Make sure you're on main branch
git checkout main

# 2. Create a new branch for your feature (optional but recommended)
git checkout -b feature/add-new-theme

# 3. Make your changes, write code, etc.
# ... edit files ...

# 4. Run tests locally before committing
pnpm test
pnpm run type-check

# 5. Commit your changes
git add .
git commit -m "feat: add dark forest theme"

# 6. Push to GitHub
git push origin feature/add-new-theme
# (or if working directly on main: git push origin main)

# 7. GitHub Actions will automatically:
#    - Run your tests
#    - Check types
#    - Try to build
#    - Deploy the Pages site from main
#    - Show ✅ or ❌ on GitHub
```

**At this point**:
- Code is on GitHub
- Tests run automatically
- The Pages deployment workflow also publishes the site from `main`
- Your live site updates after the workflow finishes

---

## Understanding the Workflows Step-by-Step

### Why separate CI and Deploy?

**CI (Continuous Integration)**:
- Runs on EVERY change
- Fast feedback: "Did I break something?"
- Prevents bad code from being merged
- Doesn't affect live site

**Deploy (Continuous Deployment)**:
- Runs from `main`
- Publishes the built `dist` artifact to GitHub Pages
- Can also be run manually from the Actions tab

### What "build" does

When you run `pnpm build` (or GitHub Actions does):

```
Your source code (src/*.vue, src/*.ts)
   ↓
   ↓ [Vite processes]
   ↓
   ↓ - Compiles TypeScript → JavaScript
   ↓ - Bundles all files together
   ↓ - Minifies code (removes spaces, shortens names)
   ↓ - Optimizes images and assets
   ↓ - Applies Tailwind CSS
   ↓
Output: ./dist folder
   ├── index.html (entry point)
   ├── assets/
   │   ├── index-[hash].js (your code, bundled)
   │   └── index-[hash].css (your styles)
   └── [images/icons]
```

This `./dist` folder is what gets deployed to GitHub Pages.

### Why `./dist` is not tracked in git

**Problem**: Build files are large, change constantly, and are auto-generated
**Solution**: Don't track them in git, generate them fresh each deployment

**Before** (old way - what you had):
- Every build creates new files
- Git shows tons of changes
- Repo gets bloated with old builds
- Merge conflicts on build files

**Now** (proper way):
- `dist/` is generated only for deployment
- GitHub Actions builds fresh each time
- Git only tracks source code
- Cleaner history

---

## Common Scenarios

### "I want to test before deploying"

```bash
# Option 1: Test locally
pnpm build
pnpm preview  # Runs local server with production build

# Option 2: Push to main and let the deploy workflow publish after CI/build succeeds
git push origin main
# Wait for the Actions runs to pass (check GitHub)
```

### "I pushed to main and CI failed"

```bash
# 1. Check the error on GitHub
#    - Go to your repo → Actions tab → Click the failed run
#    - Read the error message

# 2. Fix locally
#    ... make fixes ...

# 3. Commit and push again
git add .
git commit -m "fix: resolve test failure"
git push origin main
```

### "I want to rollback the live site"

```bash
# 1. Revert the bad commit on main
git checkout main
git revert <commit-hash-of-bad-version>
git push origin main

# 2. GitHub Actions will redeploy the reverted version
```

### "How do I know if deployment worked?"

1. Go to your repo on GitHub
2. Click "Actions" tab at top
3. You'll see:
   - **CI workflow**
   - **Deploy workflow**
4. Click the latest "Deploy to GitHub Pages" run
5. Watch the steps execute (takes ~2 min)
6. When complete, visit: https://seroph386.github.io/init-tracker/

---

## Diagram: Complete Flow

```
┌─────────────────────────────────────────────────────────┐
│  YOU (Local Computer)                                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Edit code in src/                                   │
│     ↓                                                    │
│  2. git commit -m "..."                                 │
│     ↓                                                    │
│  3. git push origin main                                │
│                                                          │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│  GITHUB (Cloud)                                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  4. Code arrives in main branch                         │
│     ↓                                                    │
│  5. ⚡ CI Workflow triggers automatically                │
│     ├─ Run tests                                        │
│     ├─ Check types                                      │
│     └─ Build                                            │
│     ↓                                                    │
│  6. ✅ All pass → Green checkmark                        │
│     ❌ Any fail → Red X (fix and push again)            │
│                                                          │
│  7. ⚡ Deploy Workflow triggers automatically            │
│     ├─ Build production bundle                          │
│     ├─ Package ./dist folder                            │
│     └─ Deploy to GitHub Pages                          │
│     ↓                                                    │
│  8. 🌐 Site updates at:                                 │
│       https://seroph386.github.io/init-tracker/         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## GitHub Pages Setup (One-time)

You need to configure GitHub Pages to use the Actions deployment:

1. Go to your repo on GitHub
2. Click **Settings** → **Pages** (left sidebar)
3. Under "Build and deployment":
   - **Source**: Select "GitHub Actions"
   - Do not choose "GitHub Pages Jekyll"
4. Save

That's it! Now the deploy workflow will handle everything.

---

## Quick Reference Commands

```bash
# Development (daily work)
git checkout main
git pull
# ... make changes ...
git add .
git commit -m "feat: description"
git push origin main

# Check status
git status              # See what's changed locally
git log --oneline -5    # See recent commits
git branch -a           # See all branches

# If you need to switch branches
git checkout main       # Switch to main
```

---

## Summary

**What you need to remember**:
1. **Work on `main`** - merged changes there are what get deployed
2. **GitHub Actions** - robots that test and deploy for you automatically
3. **GitHub Pages** must be configured to use the workflow, not branch files
4. **`./dist`** is built fresh during deployment and not committed

That's it! The robots (GitHub Actions) handle the testing and deployment for you. You just write code and decide when to release. 🤖

---

## Troubleshooting

**Q: CI is failing but it works locally?**
- Check Node.js version matches (20)
- Check if dependencies are in package.json
- Look at exact error in Actions tab

**Q: Deployment worked but site shows old version?**
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Clear browser cache
- Wait 2-3 minutes for CDN to update

**Q: I don't see the deploy workflow running?**
- Check you pushed to `main`
- Check GitHub Pages is set to "GitHub Actions" source

**Q: Build works locally but fails in Actions?**
- Usually a missing dependency
- Check package.json has all deps
- Try deleting node_modules and pnpm-lock.yaml, then pnpm install

**Q: CI fails with "packages field missing or empty"?**
- You have a `pnpm-workspace.yaml` file you don't need
- This file is only for monorepos (multiple packages)
- Solution: Delete `pnpm-workspace.yaml`

---

Need help? Open an issue and show:
1. What you were trying to do
2. What command you ran
3. Link to failed Action run (if applicable)
