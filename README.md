# iCloud Mirror

> Work in a stable local vault. Let your iPhone read a clean copy in iCloud — automatically, safely, and without conflicts.

![Platform](https://img.shields.io/badge/platform-Windows%2011-blue)
![Obsidian](https://img.shields.io/badge/Obsidian-1.0%2B-7c3aed)
![License](https://img.shields.io/badge/license-MIT-green)
![Desktop Only](https://img.shields.io/badge/desktop-only-orange)

---

## The problem

Working with an Obsidian vault **directly inside iCloud Drive on Windows** is unstable:

- Notes duplicate themselves (`note.md` → `note 2.md`)
- Files disappear mid-write due to sync race conditions
- Workspace and plugin configs get corrupted

**iCloud Mirror solves this** by letting you work in a fast, stable local folder — and automatically pushing a clean copy to iCloud only at safe moments (on save, on blur, on close).

Your iPhone reads the mirrored copy. Your desktop never touches iCloud directly.

```
D:\ObsidianVault          →  C:\Users\You\iCloudDrive\ObsidianVault_iPhone
  (you work here)                  (iPhone reads here)
```

---

## Features

- **Auto-sync** on file save, window blur, and Obsidian close
- **Debounced sync** — waits until you stop writing before copying
- **Conflict detection** using size, modification time, and MD5 hash
- **Automatic conflict backups** — nothing is ever silently overwritten
- **Safe Mode** — only adds/updates, never deletes from mirror
- **Mirror Mode** — optionally propagates deletions (manual opt-in)
- **Pull from iCloud** — manually bring changes from iPhone back to desktop
- **Status panel** with live logs, stats, and action buttons
- **Configurable exclusions** — folders, files, glob patterns
- No external servers, no cloud APIs, no subscriptions

---

## Installation

### Requirements

- Windows 11
- Obsidian 1.0+
- Node.js 18+ (only needed to build from source)

### Option A — From the Obsidian plugin directory

1. Open Obsidian → **Settings → Community plugins → Browse**
2. Search for **iCloud Mirror**
3. Click **Install** → **Enable**

### Option B — Manual (from source)

```bash
# 1. Clone the repo
git clone https://github.com/AngelCLA/icloud-mirror.git
cd icloud-mirror

# 2. Install dependencies
npm install

# 3. Build
npm run build
```

Then copy the output to your vault's plugin folder:

```powershell
$dest = "D:\ObsidianVault\.obsidian\plugins\icloud-mirror"
New-Item -ItemType Directory -Force -Path $dest
Copy-Item main.js, manifest.json, styles.css -Destination $dest
```

Reload plugins in Obsidian and enable **iCloud Mirror**.

---

## Setup

Open **Settings → iCloud Mirror** and configure:

| Setting | Recommended |
|---|---|
| Local vault path | `D:\ObsidianVault` (leave blank to use current vault) |
| iCloud mirror path | `C:\Users\You\iCloudDrive\ObsidianVault_iPhone` |
| Sync on save | ✅ ON |
| Sync on blur | ✅ ON |
| Sync on close | ✅ ON |
| Debounce delay | 5–10 seconds |
| Safe Mode | ✅ ON |
| Mirror Mode | ❌ OFF (unless you need deletions to propagate) |
| Sync vault configuration folder | ❌ OFF |

### Recommended exclusions

**Folders:**
```
.trash
node_modules
.git
```

**Files:**
```
workspace.json
workspaces.json
cache
.DS_Store
Thumbs.db
desktop.ini
*.tmp
*.lock
```

> **Why exclude the configuration folder?** Desktop plugins, themes, and workspace state are incompatible with iPhone. Syncing them causes conflicts and broken layouts on mobile. Only your notes and attachments need to reach iPhone.

---

## How it works

### Sync triggers

| Event | How it's detected |
|---|---|
| File saved or modified | `vault.on('modify')` |
| File created | `vault.on('create')` |
| File deleted or renamed | `vault.on('delete')`, `vault.on('rename')` |
| Obsidian loses focus | `window.blur` |
| Obsidian closes | `plugin.onunload()` |

All modify/save events pass through a **debounce** (default: 5 seconds). If you're actively writing, the timer resets on each keystroke — sync only fires after you pause.

### Conflict resolution

For every file, the engine runs this check before copying:

1. Destination doesn't exist → **copy directly**
2. Files have different sizes → **check mtime**
3. Destination is newer than source (by more than 2s) → **conflict**
4. Same size, different mtime → **compare MD5 hash**
5. Hashes match → **skip** (already identical)

When a conflict is detected, a timestamped backup is created before anything is overwritten:

```
note.md  →  note-conflict-2026-04-05-22-30.md
```

Nothing is ever silently lost.

### Safe Mode vs Mirror Mode

|  | Safe Mode | Mirror Mode |
|---|---|---|
| Copies new/modified files | ✅ | ✅ |
| Never deletes from mirror | ✅ | ❌ |
| Mirrors deletions | ❌ | ✅ (requires Safe Mode OFF) |

Mirror Mode must be explicitly enabled **and** Safe Mode must be turned OFF. This double opt-in prevents accidental data loss.

---

## iPhone setup

1. On your iPhone, open **Obsidian → Open vault from iCloud**
2. Select the mirrored folder (e.g. `ObsidianVault_iPhone`)
3. Done — every desktop sync updates what your iPhone sees

If you edit notes on iPhone and want to bring them back:
- Use the **Pull from iCloud** button before resuming on desktop
- Or enable **Mirror Mode** with care (and keep backups)

---

## Status panel

Open via the ribbon icon or **Command palette → iCloud Mirror: Open Status Panel**.

Shows:
- Current status: Idle / Syncing / Success / Conflict / Error
- Files copied, skipped, conflicts detected, errors
- Time of last sync
- Scrollable real-time log
- Buttons: **Sync Now**, **Pull from iCloud**, **Clear Logs**

---

## Commands

| Command | Description |
|---|---|
| `iCloud Mirror: Sync Now` | Push local → iCloud immediately |
| `iCloud Mirror: Pull from iCloud` | Pull iCloud → local (manual) |
| `iCloud Mirror: Open Status Panel` | Open status and log viewer |

---

## Troubleshooting

**Sync does nothing after saving**
Check that both paths are set in Settings and that the local path exists. The debounce delay may still be counting down.

**"Sync not ready" warning**
Either `localVaultPath` or `icloudMirrorPath` is blank or points to a folder that doesn't exist.

**Conflicts appear on every sync**
iCloud for Windows may be modifying files in the mirror folder as it uploads them. Consider pausing iCloud sync while working, or keep Safe Mode on so conflicts are backed up rather than lost.

**Plugin doesn't appear in Obsidian**
Make sure both `main.js` and `manifest.json` are inside the plugin folder, not in a subfolder.

---

## Roadmap

- [ ] `.icmignore` support (gitignore-style patterns per vault)
- [ ] Dry-run mode — preview what would be synced without copying
- [ ] Checksum cache — persist MD5s to disk for faster subsequent syncs
- [ ] Incremental backup — keep last N versions of modified files
- [ ] Conflict diff viewer — side-by-side comparison before resolving
- [ ] Sync profiles — different mirror targets for different use cases

---

## Contributing

Issues and PRs are welcome. If you find a bug or have a feature request, open an issue on GitHub.

---

## License

MIT — free to use, modify, and distribute.