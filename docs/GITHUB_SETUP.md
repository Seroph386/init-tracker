# GitHub Repository Setup Guide

This document contains final setup steps to make your repository fully polished and discoverable.

This guide assumes the `Seroph386/init-tracker` repository. Credit for the original upstream project goes to Gabriel Valforte, but this repository is maintained as a divergent rework with its own code and documentation.

## 1. Add Repository Topics

Topics help people discover your project. Add these on GitHub:

1. Go to your repository: https://github.com/Seroph386/init-tracker
2. Click the ⚙️ (gear) icon next to "About" on the right sidebar
3. Add these topics (click "Add topics"):

**Recommended topics:**
```
pathfinder
pathfinder-2e
pf2e
init-tracker
initiative-tracker
combat-tracker
rpg
tabletop
ttrpg
dnd
vue
vue3
vuejs
typescript
vite
tailwindcss
daisyui
game-master
dm-tools
```

4. While you're there, also set:
   - **Website**: `https://seroph386.github.io/init-tracker/`
   - **Description**: `A modern, themeable initiative tracker for Pathfinder 2e combat encounters with separate DM and player views`
   - Check ✅ **Releases** (once you create releases)
   - Check ✅ **Packages** (if you publish to npm)

## 2. Create a GitHub Release (v1.0.0)

When you're ready to announce your first stable version:

1. Go to: https://github.com/Seroph386/init-tracker/releases/new
2. Click "Choose a tag" → Type `v1.0.0` → Click "Create new tag: v1.0.0 on publish"
3. **Release title**: `v1.0.0 - Initial Release`
4. **Description** (use this template):

```markdown
# 🎉 Initial Release

First stable release of Pathfinder 2e Initiative Tracker!

## ✨ Features

### Combat Management
- Track initiative order with automatic sorting
- HP management with healing/damage
- Temporary HP support following PF2e rules
- Turn advancement that respects visibility settings

### Visibility System
- **Full**: Show everything to players (for PCs)
- **Half**: Show name/initiative only (for NPCs)
- **Hidden**: Hide from players and skip in turn order (for DM planning)

### Condition Tracking
- Add/remove conditions with values
- Auto-generated color-coding
- Official PF2e condition database
- Bulk condition management

### Dual View System
- **DM View**: Full control interface with all management tools
- **Player View**: Clean, read-only display synchronized via localStorage

### Customization
- 35+ DaisyUI themes
- Bilingual support (English/Portuguese)
- Persistent state across sessions

### Developer Features
- Written in TypeScript with strict mode
- Comprehensive unit tests
- CI/CD with GitHub Actions
- Full accessibility support (ARIA labels)
- Extensive JSDoc documentation

## 🎮 Try it Now

**Live Demo**: https://seroph386.github.io/init-tracker/

## 📦 Built With

- Vue 3 + TypeScript
- Tailwind CSS v4 + DaisyUI
- Vite
- VueUse
- Reka UI

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
```

5. Click "Publish release"

## 3. Add Screenshot/GIF to README

Keep the visual showcase near the top of `README.md` up to date with the latest DM, Player, and On-Deck screenshots.

### Quick Guide:

**Option A - Generated Screenshots (Recommended):**
1. Start the app locally:
   ```bash
   pnpm dev --host 127.0.0.1 --port 4173
   ```
2. In a second terminal, generate the docs images:
   ```bash
   pnpm docs:screenshots
   ```
3. Commit the updated `docs/dm-view.png`, `docs/player-view.png`, and `docs/on-deck-view.png`

**Option B - Manual Screenshots:**
1. Open the DM view and capture it as `docs/dm-view.png`
2. Open the player view (`?view=player`) and capture it as `docs/player-view.png`
3. Open the on-deck view (`?view=on-deck`) and capture it as `docs/on-deck-view.png`

**Option C - Animated Demo:**
1. Install screen recording tool:
   - macOS: [Kap](https://getkap.co/) (free)
   - Windows: [ScreenToGif](https://www.screentogif.com/) (free)
   - Cross-platform: [LICEcap](https://www.cockos.com/licecap/) (free)

2. Record a 10-15 second demo showing:
   - Adding a combatant
   - Dealing damage
   - Adding a condition
   - Advancing turn
   - Switching to player view

3. Export as GIF (max 10MB for GitHub)
4. Save as `docs/demo.gif`
5. In README, replace the TODO comment with:
   ```markdown
   ![Initiative Tracker Demo](docs/demo.gif)
   ```

## 4. Set Up GitHub Pages

**Important**: Your project uses GitHub Actions for deployment, not branch deployment.

1. Go to Settings → Pages
2. Under "Build and deployment":
   - **Source**: Select **"GitHub Actions"** (not "Deploy from a branch")
3. That's it!

**How it works**:
- When you push to `prod` branch, GitHub Actions automatically builds and deploys
- See `GIT_WORKFLOW.md` for detailed explanation
- Your workflow file: `.github/workflows/deploy.yml`

The site will be available at: https://seroph386.github.io/init-tracker/

## 5. Enable GitHub Discussions (Optional)

Great for community questions and feature discussions:

1. Go to Settings → General
2. Scroll to "Features"
3. Check ✅ "Discussions"
4. Click "Set up discussions"
5. Use the default categories or customize

## 6. Social Media Announcement (Optional)

Once everything is polished, share it with the community:

### Reddit:
- r/Pathfinder2e
- r/Pathfinder_RPG
- r/rpg
- r/DMAcademy (if it works for general TTRPGs)

### Example Post:
```
Title: [Tool] Free, Open-Source Initiative Tracker for Pathfinder 2e

Body:
I've built a free initiative tracker specifically for PF2e with features like:
- Separate DM and player views
- Temp HP tracking following PF2e rules
- 3-tier visibility system for PCs/NPCs/hidden creatures
- Built-in PF2e condition database
- 35+ themes
- Works completely in-browser (no server needed)

Live demo: https://seroph386.github.io/init-tracker/
GitHub (MIT license): https://github.com/Seroph386/init-tracker

Would love feedback from the community!
```

### Twitter/X, Mastodon, etc.:
```
🎲 Just released a free, open-source initiative tracker for #Pathfinder2e!

✨ Features:
- DM/player views
- Temp HP support
- PF2e conditions
- 35+ themes
- Fully localized

Try it: https://seroph386.github.io/init-tracker/

#PF2e #TTRPG #OpenSource
```

## 7. Monitor Your Project

After launch, monitor:
- ⭐ **Stars**: Shows interest
- 👀 **Watchers**: People following updates
- 🍴 **Forks**: Developers building on your work
- 📊 **Traffic**: Settings → Insights → Traffic
- 🐛 **Issues**: Bug reports and feature requests

## 8. Maintenance Best Practices

- Respond to issues within 48 hours (even if just to acknowledge)
- Label issues appropriately (`bug`, `enhancement`, `good first issue`, etc.)
- Create milestones for major feature releases
- Keep dependencies updated (use Dependabot)
- Thank contributors in release notes

---

## Quick Checklist

- [ ] Add repository topics on GitHub
- [ ] Set repository description and website URL
- [ ] Add screenshot or GIF to README
- [ ] Create v1.0.0 release
- [ ] Verify GitHub Pages is working
- [ ] Enable Discussions (optional)
- [ ] Announce on social media (optional)
- [ ] Star your own repo (why not? 😄)

Congratulations on your open source project! 🎉
