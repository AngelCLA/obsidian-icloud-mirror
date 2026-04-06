# iCloud Mirror — Obsidian Plugin

> **Mirror your local Obsidian vault to iCloud Drive automatically, safely and conflict-free.**

Works on **Windows 11 + Obsidian Desktop** only. Your iPhone reads the mirrored copy inside iCloud; you work in a stable local folder.

---

## Why this exists

Working with a vault **directly inside iCloud Drive on Windows** causes:
- Duplicate files (e.g. `note.md` and `note 2.md`)
- Files disappearing while writing (iCloud sync race conditions)
- Workspace/plugin corruption

This plugin lets you **work locally**, then **push a clean copy to iCloud** — at the right moment, not constantly.

---

## Installation (local/manual)

### Prerequisites
- Node.js 18+ installed
- Obsidian 1.0+
- A vault open in Obsidian

### Step 1 — Clone / download the plugin

```bash
# Option A: git clone
git clone https://github.com/AngelCLA/obsidian-icloud-mirror.git
cd obsidian-icloud-mirror

# Option B: download ZIP, extract, cd into folder
```

### Step 2 — Install dependencies

```bash
npm install
```

### Step 3 — Build the plugin

```bash
# One-time production build
npm run build

# OR: watch mode during development
npm run dev
```

This generates `main.js` in the root folder.

### Step 4 — Copy to your vault's plugins folder

```
YourVault/.obsidian/plugins/obsidian-icloud-mirror/
  ├── main.js        ← compiled output
  ├── manifest.json
  └── styles.css     ← (optional, create empty if needed)
```

In PowerShell:

```powershell
# Replace paths as needed
$dest = "D:\ObsidianVault\.obsidian\plugins\obsidian-icloud-mirror"
New-Item -ItemType Directory -Force -Path $dest
Copy-Item main.js, manifest.json -Destination $dest
```

### Step 5 — Enable in Obsidian

1. Open Obsidian → **Settings → Community plugins**
2. Turn off **Safe mode** (if prompted)
3. Click **Reload plugins**
4. Enable **iCloud Mirror**

---

## Configuration

Go to **Settings → iCloud Mirror**:

| Setting | Recommended value |
|---|---|
| Local vault path | `D:\ObsidianVault` (or leave blank to use current vault) |
| iCloud mirror path | `C:\Users\You\iCloudDrive\ObsidianVault_iPhone` |
| Sync on save | ✅ ON |
| Sync on blur | ✅ ON |
| Sync on close | ✅ ON |
| Debounce delay | 5–10 seconds |
| Safe Mode | ✅ ON (always, unless you know what you're doing) |
| Mirror Mode | ❌ OFF (only enable if you want deletions to propagate) |
| Sync .obsidian folder | ❌ OFF (themes and plugins differ between desktop and iPhone) |

### Recommended excluded folders

```
.trash
node_modules
.git
```

### Recommended excluded files

```
.obsidian/workspace.json
.obsidian/workspaces.json
.obsidian/cache
.DS_Store
Thumbs.db
desktop.ini
*.tmp
*.lock
```

---

## How it works

### Change detection

The plugin hooks into Obsidian's vault events:
- `vault.on('modify')` — file modified
- `vault.on('create')` — file created
- `vault.on('delete')` — file deleted
- `vault.on('rename')` — file renamed
- `window.blur` — window loses focus (switch app)
- `plugin.onunload()` — Obsidian is closing

All save/modify events are **debounced** (default: 5 seconds) so syncing doesn't trigger on every keystroke.

### Conflict resolution

For each file, the engine:
1. **Checks if dest exists** → if not, copy directly
2. **Compares size** → if different, check further
3. **Compares mtime** (2-second tolerance for FAT/iCloud rounding)
4. **Hashes both files** (MD5) if sizes match but mtimes differ
5. If dest is **newer than src** → **conflict detected**:
   - A backup is created: `note-conflict-2026-04-05-22-30.md`
   - Then src is copied over
   - Nothing is silently lost

### Safe Mode vs Mirror Mode

| | Safe Mode | Mirror Mode |
|---|---|---|
| Copies new/modified files | ✅ | ✅ |
| Never deletes from mirror | ✅ | ❌ |
| Mirrors deletions | ❌ | ✅ (only when Safe Mode OFF) |

Mirror Mode must be explicitly enabled **and** Safe Mode must be OFF.

---

## Commands

| Command | Action |
|---|---|
| `iCloud Mirror: Sync Now` | Push local → iCloud immediately |
| `iCloud Mirror: Pull from iCloud` | Pull iCloud → local (manual) |
| `iCloud Mirror: Open Status Panel` | Open the status/logs modal |

The ribbon icon (cloud with arrow) also triggers Sync Now.

---

## Status Panel

Open via command palette or ribbon. Shows:
- Current status (Idle / Syncing / Success / Conflict / Error)
- Files copied, skipped, conflicts, errors
- Last sync time
- Scrollable log viewer
- Buttons: Sync Now, Pull from iCloud, Clear Logs

---

## What NOT to sync

| Folder/File | Why |
|---|---|
| `.obsidian/workspace.json` | Tracks open tabs — irrelevant on iPhone |
| `.obsidian/workspaces.json` | Same |
| `.obsidian/cache` | Large, regenerated automatically |
| `.obsidian/plugins/` | iPhone uses mobile plugins, not desktop |
| `.obsidian/themes/` | Desktop themes don't apply on iPhone |
| `node_modules/` | Dev artifacts, not vault content |
| `.trash/` | Obsidian trash bin |
| `*.tmp` / `*.lock` | Temporary files |

If you want your iPhone to have your **custom CSS snippets**, you can selectively include `.obsidian/snippets/` by removing it from the exclusion list.

---

## iPhone setup

1. On your iPhone, open **Obsidian → Open vault from iCloud**
2. Select the mirrored folder (e.g. `ObsidianVault_iPhone` inside iCloud Drive)
3. That's it — every time you sync from desktop, iPhone sees the updated notes

The iPhone only **reads** from that folder. It can write too, but if you do:
- Use **Pull from iCloud** before editing on iPhone and returning to desktop
- Or enable **Mirror Mode** with care

---

## Troubleshooting

**Sync does nothing after save**
→ Check paths in Settings. Local path must exist. Debounce delay may still be counting.

**"Sync not ready" warning**
→ Either `localVaultPath` or `icloudMirrorPath` is empty or doesn't exist.

**Conflicts appear constantly**
→ iCloud is modifying files on Windows (cloud sync). Stop iCloud from syncing the mirror path to the internet while working, or use Safe Mode.

**Plugin not showing in Obsidian**
→ Make sure `manifest.json` is in the plugin folder alongside `main.js`.

---

## Future improvements (roadmap ideas)

- [ ] Dry-run mode: preview what would be copied without doing it
- [ ] Checksum cache: persist hashes to avoid re-hashing on every sync
- [ ] Incremental backup: keep last N versions of changed files
- [ ] Toast notifications with sync summary
- [ ] Conflict resolution UI: side-by-side diff viewer
- [ ] Sync profile presets: work/personal/iphone
- [ ] `.icmignore` file support (gitignore-style patterns)

---

## License

MIT — use freely, modify as needed.
