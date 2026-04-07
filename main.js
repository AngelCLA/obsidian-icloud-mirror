/*
THIS IS A GENERATED/COMPILED FILE.
*/

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ICloudMirrorPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/types.ts
var DEFAULT_SETTINGS = {
  localVaultPath: "",
  icloudMirrorPath: "",
  syncOnSave: true,
  syncOnBlur: true,
  syncOnClose: true,
  autoSyncInterval: 0,
  excludedFolders: [
    ".trash",
    "node_modules",
    ".git"
  ],
  excludedFiles: [
    "workspace.json",
    "workspaces.json",
    "cache",
    ".DS_Store",
    "Thumbs.db",
    "desktop.ini",
    "*.tmp",
    "*.lock"
  ],
  syncObsidianFolder: false,
  safeMode: true,
  mirrorMode: false,
  verboseLogs: false,
  debounceDelay: 5
};

// src/fileUtils.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var crypto = __toESM(require("crypto"));
var FileUtils = class {
  constructor() {
    this.logs = [];
    this.verbose = false;
    this.configDir = "";
  }
  setVerbose(v) {
    this.verbose = v;
  }
  setConfigDir(dir) {
    this.configDir = dir;
  }
  getLogs() {
    return this.logs;
  }
  clearLogs() {
    this.logs = [];
  }
  log(level, message) {
    const entry = { timestamp: new Date(), level, message };
    this.logs.push(entry);
    if (this.logs.length > 1e3)
      this.logs.shift();
    if (level === "debug" && !this.verbose)
      return;
    const prefix = `[iCloud Mirror] [${level.toUpperCase()}]`;
    if (level === "error")
      console.error(prefix, message);
    else if (level === "warn")
      console.warn(prefix, message);
    else
      console.debug(prefix, message);
  }
  info(msg) {
    this.log("info", msg);
  }
  warn(msg) {
    this.log("warn", msg);
  }
  error(msg) {
    this.log("error", msg);
  }
  debug(msg) {
    this.log("debug", msg);
  }
  /**
   * Compute MD5 hash of a file for conflict detection
   */
  async computeHash(filePath) {
    try {
      const hash = crypto.createHash("md5");
      const stream = fs.createReadStream(filePath);
      return await new Promise((resolve, reject) => {
        stream.on("data", (chunk) => hash.update(chunk));
        stream.on("end", () => resolve(hash.digest("hex")));
        stream.on("error", reject);
      });
    } catch (e) {
      return null;
    }
  }
  /**
   * Get a FileEntry (stat + optional hash) for a path
   */
  async getFileEntry(absolutePath, relativePath, withHash = false) {
    var _a;
    try {
      const stat = fs.statSync(absolutePath);
      const entry = {
        relativePath,
        absolutePath,
        mtime: stat.mtimeMs,
        size: stat.size
      };
      if (withHash) {
        entry.hash = (_a = await this.computeHash(absolutePath)) != null ? _a : void 0;
      }
      return entry;
    } catch (e) {
      return null;
    }
  }
  /**
   * Recursively list all files in a directory, returning relative paths
   */
  listFiles(dir, excludedFolders, excludedFiles, syncObsidian) {
    const results = [];
    if (!fs.existsSync(dir))
      return results;
    const walk = (current, rel) => {
      let entries;
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch (e) {
        this.warn(`Cannot read directory: ${current}`);
        return;
      }
      for (const entry of entries) {
        const relPath = rel ? `${rel}/${entry.name}` : entry.name;
        const absPath = path.join(current, entry.name);
        if (!syncObsidian && (entry.name === this.configDir || relPath.startsWith(this.configDir + "/"))) {
          continue;
        }
        if (entry.isDirectory()) {
          if (this.matchesExcludedFolder(relPath, excludedFolders)) {
            this.debug(`Skipping excluded folder: ${relPath}`);
            continue;
          }
          walk(absPath, relPath);
        } else if (entry.isFile()) {
          if (this.matchesExcludedFile(relPath, excludedFiles)) {
            this.debug(`Skipping excluded file: ${relPath}`);
            continue;
          }
          results.push(relPath);
        }
      }
    };
    walk(dir, "");
    return results;
  }
  matchesExcludedFolder(relPath, excluded) {
    return excluded.some((ex) => {
      const norm = ex.replace(/\\/g, "/").replace(/^\//, "").replace(/\/$/, "");
      return relPath === norm || relPath.startsWith(norm + "/");
    });
  }
  matchesExcludedFile(relPath, excluded) {
    return excluded.some((ex) => {
      if (ex.includes("*")) {
        const regex = new RegExp(
          "^" + ex.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$"
        );
        const name = path.basename(relPath);
        return regex.test(name) || regex.test(relPath);
      }
      return relPath === ex || relPath.endsWith("/" + ex);
    });
  }
  /**
   * Copy a file from src to dest, ensuring dest directory exists.
   * Preserves mtime.
   */
  async copyFile(src, dest) {
    const destDir = path.dirname(dest);
    fs.mkdirSync(destDir, { recursive: true });
    await fs.promises.copyFile(src, dest);
    try {
      const stat = fs.statSync(src);
      fs.utimesSync(dest, stat.atime, stat.mtime);
    } catch (e) {
    }
  }
  /**
   * Generate a conflict backup filename
   */
  conflictPath(destPath) {
    const ext = path.extname(destPath);
    const base = destPath.slice(0, destPath.length - ext.length);
    const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "-").slice(0, 19);
    return `${base}-conflict-${ts}${ext}`;
  }
  /**
   * Safely delete a file (used only in Mirror Mode)
   */
  deleteFile(filePath) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  /**
   * Check if two files are identical by size + mtime (fast) then hash (thorough)
   */
  async areFilesIdentical(a, b) {
    try {
      const sa = fs.statSync(a);
      const sb = fs.statSync(b);
      if (sa.size !== sb.size)
        return false;
      if (Math.abs(sa.mtimeMs - sb.mtimeMs) < 2e3)
        return true;
      const ha = await this.computeHash(a);
      const hb = await this.computeHash(b);
      return ha !== null && ha === hb;
    } catch (e) {
      return false;
    }
  }
  pathExists(p) {
    return fs.existsSync(p);
  }
  ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// src/conflictResolver.ts
var fs2 = __toESM(require("fs"));
var ConflictResolver = class {
  constructor(fileUtils) {
    this.fileUtils = fileUtils;
  }
  /**
   * Determine if src should overwrite dest.
   * Returns:
   *   "copy"     → src is newer/different, safe to copy
   *   "skip"     → dest is identical, skip
   *   "conflict" → dest is newer than src (potential data loss)
   */
  async evaluate(srcPath, destPath, relativePath) {
    if (!fs2.existsSync(destPath)) {
      return { action: "copy" };
    }
    const identical = await this.fileUtils.areFilesIdentical(srcPath, destPath);
    if (identical) {
      return { action: "skip" };
    }
    const srcStat = fs2.statSync(srcPath);
    const destStat = fs2.statSync(destPath);
    if (destStat.mtimeMs > srcStat.mtimeMs + 2e3) {
      return {
        action: "conflict",
        conflict: {
          relativePath,
          localMtime: srcStat.mtimeMs,
          remoteMtime: destStat.mtimeMs,
          localSize: srcStat.size,
          remoteSize: destStat.size
        }
      };
    }
    return { action: "copy" };
  }
  /**
   * Create a safe backup of dest before overwriting, so data is never lost.
   */
  async backup(destPath) {
    const backupPath = this.fileUtils.conflictPath(destPath);
    await this.fileUtils.copyFile(destPath, backupPath);
    this.fileUtils.warn(
      `Conflict backup created: ${backupPath}`
    );
    return backupPath;
  }
};

// src/syncEngine.ts
var path2 = __toESM(require("path"));
var SyncEngine = class {
  constructor(settings, fileUtils, conflictResolver) {
    this.settings = settings;
    this.fileUtils = fileUtils;
    this.conflictResolver = conflictResolver;
    this.running = false;
    this.configDir = "";
    this.stats = {
      lastSync: null,
      filesCopied: 0,
      filesSkipped: 0,
      filesDeleted: 0,
      conflictsDetected: 0,
      errors: 0
    };
    this.status = "idle";
    this.onStatusChange = null;
  }
  setConfigDir(dir) {
    this.configDir = dir;
    this.fileUtils.setConfigDir(dir);
  }
  setStatusCallback(cb) {
    this.onStatusChange = cb;
  }
  updateSettings(settings) {
    this.settings = settings;
  }
  getStats() {
    return { ...this.stats };
  }
  getStatus() {
    return this.status;
  }
  setStatus(status) {
    var _a;
    this.status = status;
    (_a = this.onStatusChange) == null ? void 0 : _a.call(this, status, this.getStats());
  }
  isReady() {
    const { localVaultPath, icloudMirrorPath } = this.settings;
    return !!localVaultPath && !!icloudMirrorPath && this.fileUtils.pathExists(localVaultPath);
  }
  /**
   * Main sync: Local → iCloud (primary direction)
   */
  async syncLocalToCloud() {
    if (this.running) {
      this.fileUtils.info("Sync already in progress, skipping.");
      return;
    }
    if (!this.isReady()) {
      this.fileUtils.warn("Sync not ready: check paths in settings.");
      this.setStatus("error");
      return;
    }
    this.running = true;
    this.setStatus("syncing");
    const { localVaultPath, icloudMirrorPath } = this.settings;
    const sessionStats = {
      copied: 0,
      skipped: 0,
      deleted: 0,
      conflicts: 0,
      errors: 0
    };
    try {
      this.fileUtils.info(
        `Starting sync: ${localVaultPath} \u2192 ${icloudMirrorPath}`
      );
      this.fileUtils.ensureDir(icloudMirrorPath);
      const localFiles = this.fileUtils.listFiles(
        localVaultPath,
        this.settings.excludedFolders,
        this.settings.excludedFiles,
        this.settings.syncObsidianFolder
      );
      for (const relPath of localFiles) {
        const srcAbs = path2.join(localVaultPath, relPath);
        const destAbs = path2.join(icloudMirrorPath, relPath);
        try {
          const eval_ = await this.conflictResolver.evaluate(
            srcAbs,
            destAbs,
            relPath
          );
          if (eval_.action === "skip") {
            this.fileUtils.debug(`Skip (identical): ${relPath}`);
            sessionStats.skipped++;
          } else if (eval_.action === "conflict") {
            this.fileUtils.warn(`Conflict detected: ${relPath}`);
            sessionStats.conflicts++;
            this.setStatus("conflict");
            await this.conflictResolver.backup(destAbs);
            await this.fileUtils.copyFile(srcAbs, destAbs);
            sessionStats.copied++;
          } else {
            this.fileUtils.debug(`Copy: ${relPath}`);
            await this.fileUtils.copyFile(srcAbs, destAbs);
            sessionStats.copied++;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.fileUtils.error(`Error processing ${relPath}: ${message}`);
          sessionStats.errors++;
        }
      }
      if (this.settings.mirrorMode && !this.settings.safeMode) {
        const destFiles = this.fileUtils.listFiles(
          icloudMirrorPath,
          this.settings.excludedFolders,
          this.settings.excludedFiles,
          this.settings.syncObsidianFolder
        );
        const localSet = new Set(localFiles);
        for (const relPath of destFiles) {
          if (!localSet.has(relPath)) {
            const destAbs = path2.join(icloudMirrorPath, relPath);
            this.fileUtils.info(`Mirror delete: ${relPath}`);
            try {
              this.fileUtils.deleteFile(destAbs);
              sessionStats.deleted++;
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              this.fileUtils.error(
                `Failed to delete ${relPath}: ${message}`
              );
              sessionStats.errors++;
            }
          }
        }
      }
      this.stats.lastSync = new Date();
      this.stats.filesCopied += sessionStats.copied;
      this.stats.filesSkipped += sessionStats.skipped;
      this.stats.filesDeleted += sessionStats.deleted;
      this.stats.conflictsDetected += sessionStats.conflicts;
      this.stats.errors += sessionStats.errors;
      const hasConflicts = sessionStats.conflicts > 0;
      this.setStatus(hasConflicts ? "conflict" : "success");
      this.fileUtils.info(
        `Sync complete. Copied: ${sessionStats.copied}, Skipped: ${sessionStats.skipped}, Conflicts: ${sessionStats.conflicts}, Deleted: ${sessionStats.deleted}, Errors: ${sessionStats.errors}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.fileUtils.error(`Sync failed: ${message}`);
      this.setStatus("error");
      this.stats.errors++;
    } finally {
      this.running = false;
    }
  }
  /**
   * Pull: iCloud → Local (manual only)
   */
  async syncCloudToLocal() {
    if (this.running) {
      this.fileUtils.info("Sync already in progress, skipping.");
      return;
    }
    if (!this.isReady()) {
      this.setStatus("error");
      return;
    }
    this.running = true;
    this.setStatus("syncing");
    const { localVaultPath, icloudMirrorPath } = this.settings;
    const sessionStats = {
      copied: 0,
      skipped: 0,
      conflicts: 0,
      errors: 0
    };
    try {
      if (!this.fileUtils.pathExists(icloudMirrorPath)) {
        this.fileUtils.warn("iCloud mirror path does not exist.");
        this.setStatus("error");
        return;
      }
      this.fileUtils.info(
        `Pulling: ${icloudMirrorPath} \u2192 ${localVaultPath}`
      );
      const cloudFiles = this.fileUtils.listFiles(
        icloudMirrorPath,
        this.settings.excludedFolders,
        this.settings.excludedFiles,
        this.settings.syncObsidianFolder
      );
      for (const relPath of cloudFiles) {
        const srcAbs = path2.join(icloudMirrorPath, relPath);
        const destAbs = path2.join(localVaultPath, relPath);
        try {
          const eval_ = await this.conflictResolver.evaluate(
            srcAbs,
            destAbs,
            relPath
          );
          if (eval_.action === "skip") {
            sessionStats.skipped++;
          } else if (eval_.action === "conflict") {
            sessionStats.conflicts++;
            this.setStatus("conflict");
            await this.conflictResolver.backup(destAbs);
            await this.fileUtils.copyFile(srcAbs, destAbs);
            sessionStats.copied++;
          } else {
            await this.fileUtils.copyFile(srcAbs, destAbs);
            sessionStats.copied++;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.fileUtils.error(`Error pulling ${relPath}: ${message}`);
          sessionStats.errors++;
        }
      }
      this.stats.lastSync = new Date();
      this.stats.filesCopied += sessionStats.copied;
      this.stats.filesSkipped += sessionStats.skipped;
      this.stats.conflictsDetected += sessionStats.conflicts;
      this.stats.errors += sessionStats.errors;
      this.setStatus(sessionStats.conflicts > 0 ? "conflict" : "success");
      this.fileUtils.info(
        `Pull complete. Copied: ${sessionStats.copied}, Skipped: ${sessionStats.skipped}, Conflicts: ${sessionStats.conflicts}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.fileUtils.error(`Pull failed: ${message}`);
      this.setStatus("error");
    } finally {
      this.running = false;
    }
  }
  resetSessionStats() {
    this.stats = {
      lastSync: null,
      filesCopied: 0,
      filesSkipped: 0,
      filesDeleted: 0,
      conflictsDetected: 0,
      errors: 0
    };
  }
};

// src/settings.ts
var import_obsidian = require("obsidian");
var ICloudMirrorSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("iCloud Mirror").setHeading();
    new import_obsidian.Setting(containerEl).setName("\u{1F4C1} Paths").setHeading();
    new import_obsidian.Setting(containerEl).setName("Local vault path").setDesc(
      "Absolute path to your local working vault (e.g. D:\\ObsidianVault). Leave blank to use the current vault path."
    ).addText(
      (text) => text.setPlaceholder("D:\\ObsidianVault").setValue(this.plugin.settings.localVaultPath).onChange(async (value) => {
        this.plugin.settings.localVaultPath = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("iCloud mirror path").setDesc(
      "Absolute path to the iCloud Drive folder that your iPhone reads (e.g. C:\\Users\\You\\iCloudDrive\\ObsidianVault_iPhone)."
    ).addText(
      (text) => text.setPlaceholder("C:\\Users\\You\\iCloudDrive\\ObsidianVault_iPhone").setValue(this.plugin.settings.icloudMirrorPath).onChange(async (value) => {
        this.plugin.settings.icloudMirrorPath = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u26A1 Sync triggers").setHeading();
    new import_obsidian.Setting(containerEl).setName("Sync on file save").setDesc("Sync after a note is saved (with debounce delay).").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.syncOnSave).onChange(async (value) => {
        this.plugin.settings.syncOnSave = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Sync when Obsidian loses focus").setDesc("Sync when you switch away from Obsidian.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.syncOnBlur).onChange(async (value) => {
        this.plugin.settings.syncOnBlur = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Sync on Obsidian close").setDesc("Sync before Obsidian closes.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.syncOnClose).onChange(async (value) => {
        this.plugin.settings.syncOnClose = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Auto-sync interval (minutes)").setDesc("0 to disable periodic sync.").addSlider(
      (slider) => slider.setLimits(0, 60, 1).setValue(this.plugin.settings.autoSyncInterval).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.autoSyncInterval = value;
        await this.plugin.saveSettings();
        this.plugin.restartAutoSync();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Debounce delay (seconds)").setDesc(
      "Wait this many seconds after last save before syncing. Prevents syncing while actively writing."
    ).addSlider(
      (slider) => slider.setLimits(1, 30, 1).setValue(this.plugin.settings.debounceDelay).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.debounceDelay = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u{1F6AB} Exclusions").setHeading();
    new import_obsidian.Setting(containerEl).setName("Excluded folders").setDesc(
      "One per line. Relative paths like .trash, node_modules, .git"
    ).addTextArea((text) => {
      text.setPlaceholder(".trash\nnode_modules\n.git").setValue(this.plugin.settings.excludedFolders.join("\n")).onChange(async (value) => {
        this.plugin.settings.excludedFolders = value.split("\n").map((s) => s.trim()).filter(Boolean);
        await this.plugin.saveSettings();
      });
      text.inputEl.rows = 5;
    });
    new import_obsidian.Setting(containerEl).setName("Excluded files").setDesc(
      "One per line. Supports glob patterns like *.tmp or exact paths like workspace.json"
    ).addTextArea((text) => {
      text.setPlaceholder(
        "workspace.json\nworkspaces.json\ncache\n*.tmp\n*.lock"
      ).setValue(this.plugin.settings.excludedFiles.join("\n")).onChange(async (value) => {
        this.plugin.settings.excludedFiles = value.split("\n").map((s) => s.trim()).filter(Boolean);
        await this.plugin.saveSettings();
      });
      text.inputEl.rows = 5;
    });
    new import_obsidian.Setting(containerEl).setName("Sync vault configuration folder").setDesc(
      "Include the vault configuration folder in sync. Recommended: OFF \u2014 themes/plugins may be incompatible between desktop and iPhone."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.syncObsidianFolder).onChange(async (value) => {
        this.plugin.settings.syncObsidianFolder = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u{1F6E1}\uFE0F Safety").setHeading();
    new import_obsidian.Setting(containerEl).setName("Safe mode").setDesc(
      "Only adds/updates files. Never deletes from the mirror. Strongly recommended."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.safeMode).onChange(async (value) => {
        this.plugin.settings.safeMode = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Mirror mode (deletes in mirror)").setDesc(
      "\u26A0\uFE0F When enabled AND Safe Mode is OFF, deletions in your local vault are mirrored to iCloud. Use with caution."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.mirrorMode).onChange(async (value) => {
        if (value && this.plugin.settings.safeMode) {
          new import_obsidian.Notice(
            "Mirror Mode requires Safe Mode to be OFF. Disable Safe Mode first.",
            5e3
          );
          toggle.setValue(false);
          return;
        }
        this.plugin.settings.mirrorMode = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u{1FAB5} Logging").setHeading();
    new import_obsidian.Setting(containerEl).setName("Verbose logs").setDesc("Log every file checked (not just copies). Useful for debugging.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.verboseLogs).onChange(async (value) => {
        this.plugin.settings.verboseLogs = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u{1F527} Manual actions").setHeading();
    new import_obsidian.Setting(containerEl).setName("Reset session stats").setDesc("Reset the file/conflict counters.").addButton(
      (btn) => btn.setButtonText("Reset").onClick(() => {
        this.plugin.syncEngine.resetSessionStats();
        new import_obsidian.Notice("Stats reset.");
      })
    );
  }
};

// src/ui.ts
var import_obsidian2 = require("obsidian");
var SyncStatusModal = class extends import_obsidian2.Modal {
  constructor(app, syncEngine, fileUtils, onSyncNow, onPullFromCloud) {
    super(app);
    this.syncEngine = syncEngine;
    this.fileUtils = fileUtils;
    this.onSyncNow = onSyncNow;
    this.onPullFromCloud = onPullFromCloud;
    this.refreshInterval = null;
  }
  onOpen() {
    this.render();
    this.refreshInterval = window.setInterval(() => this.render(), 2e3);
  }
  onClose() {
    if (this.refreshInterval !== null) {
      clearInterval(this.refreshInterval);
    }
  }
  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "iCloud Mirror" });
    const status = this.syncEngine.getStatus();
    const stats = this.syncEngine.getStats();
    const badge = contentEl.createEl("div", {
      cls: "icm-status-badge",
      text: this.statusLabel(status)
    });
    badge.setCssProps({
      "background-color": this.statusColor(status)
    });
    const grid = contentEl.createEl("div", { cls: "icm-stats-grid" });
    this.statBox(grid, "Last sync", this.formatDate(stats.lastSync));
    this.statBox(grid, "Files copied", String(stats.filesCopied));
    this.statBox(grid, "Files skipped", String(stats.filesSkipped));
    this.statBox(grid, "Conflicts", String(stats.conflictsDetected));
    this.statBox(grid, "Deletions", String(stats.filesDeleted));
    this.statBox(grid, "Errors", String(stats.errors));
    const btnRow = contentEl.createEl("div", { cls: "icm-btn-row" });
    const syncBtn = btnRow.createEl("button", { text: "\u2B06 Sync now (local \u2192 iCloud)", cls: "icm-btn" });
    syncBtn.onclick = () => {
      this.onSyncNow();
      this.render();
    };
    const pullBtn = btnRow.createEl("button", { text: "\u2B07 Pull from iCloud", cls: "icm-btn" });
    pullBtn.onclick = () => {
      this.onPullFromCloud();
      this.render();
    };
    contentEl.createEl("h3", { text: "Recent logs" });
    const logContainer = contentEl.createEl("div", { cls: "icm-log-container" });
    const logs = this.fileUtils.getLogs().slice(-60).reverse();
    if (logs.length === 0) {
      logContainer.createEl("div", {
        text: "No logs yet.",
        cls: "icm-log-empty"
      });
    }
    for (const entry of logs) {
      const row = logContainer.createEl("div", { cls: "icm-log-row" });
      const colorClass = `icm-log-${entry.level}`;
      row.addClass(colorClass);
      const ts = entry.timestamp.toLocaleTimeString();
      row.textContent = `[${ts}] ${entry.level.toUpperCase()} \u2014 ${entry.message}`;
    }
    const clearBtn = contentEl.createEl("button", { text: "Clear logs", cls: "icm-btn icm-btn-sm" });
    clearBtn.onclick = () => {
      this.fileUtils.clearLogs();
      this.render();
    };
  }
  statBox(parent, label, value) {
    const box = parent.createEl("div", { cls: "icm-stat-box" });
    box.createEl("div", { text: value, cls: "icm-stat-value" });
    box.createEl("div", { text: label, cls: "icm-stat-label" });
  }
  statusLabel(status) {
    var _a;
    const map = {
      idle: "\u23F8 Idle",
      syncing: "\u{1F504} Syncing\u2026",
      success: "\u2705 Success",
      conflict: "\u26A0\uFE0F Conflict detected",
      error: "\u274C Error",
      disabled: "\u26D4 Disabled"
    };
    return (_a = map[status]) != null ? _a : status;
  }
  statusColor(status) {
    var _a;
    const map = {
      idle: "#666",
      syncing: "#4a90e2",
      success: "#27ae60",
      conflict: "#e67e22",
      error: "#e74c3c",
      disabled: "#999"
    };
    return (_a = map[status]) != null ? _a : "#666";
  }
  logColor(level) {
    if (level === "error")
      return "var(--color-red)";
    if (level === "warn")
      return "var(--color-yellow)";
    if (level === "debug")
      return "var(--text-muted)";
    return "var(--text-normal)";
  }
  formatDate(d) {
    if (!d)
      return "Never";
    return d.toLocaleTimeString();
  }
};

// main.ts
function debounce(fn, delayMs) {
  let timer = null;
  return (...args) => {
    if (timer !== null)
      clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delayMs);
  };
}
var ICloudMirrorPlugin = class extends import_obsidian3.Plugin {
  constructor() {
    super(...arguments);
    this.autoSyncTimer = null;
    this.debouncedSync = null;
    this.blurHandler = null;
  }
  async onload() {
    var _a;
    await this.loadSettings();
    this.fileUtils = new FileUtils();
    this.fileUtils.setVerbose(this.settings.verboseLogs);
    this.conflictResolver = new ConflictResolver(this.fileUtils);
    this.syncEngine = new SyncEngine(
      this.settings,
      this.fileUtils,
      this.conflictResolver
    );
    if (!this.settings.localVaultPath) {
      const adapter = this.app.vault.adapter;
      if (adapter == null ? void 0 : adapter.basePath) {
        this.settings.localVaultPath = adapter.basePath;
      }
    }
    const syncEngineWithConfig = this.syncEngine;
    (_a = syncEngineWithConfig.setConfigDir) == null ? void 0 : _a.call(syncEngineWithConfig, this.app.vault.configDir);
    this.syncEngine.setStatusCallback((_status) => {
    });
    (0, import_obsidian3.addIcon)(
      "cloud-upload",
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>`
    );
    this.addRibbonIcon("cloud-upload", "iCloud Mirror: sync now", () => {
      void this.triggerSync();
    });
    this.addCommand({
      id: "sync-now",
      name: "Sync now (local \u2192 iCloud)",
      callback: () => {
        void this.triggerSync();
      }
    });
    this.addCommand({
      id: "pull-from-icloud",
      name: "Pull from iCloud \u2192 local",
      callback: () => {
        void this.triggerPull();
      }
    });
    this.addCommand({
      id: "open-status",
      name: "Open status panel",
      callback: () => this.openStatusModal()
    });
    this.addSettingTab(new ICloudMirrorSettingTab(this.app, this));
    this.registerEvents();
    this.restartAutoSync();
    new import_obsidian3.Notice("iCloud mirror loaded \u2713", 3e3);
  }
  onunload() {
    if (this.settings.syncOnClose) {
      void this.syncEngine.syncLocalToCloud().catch((e) => {
        console.error("[iCloud Mirror] Error on close sync:", e);
      });
    }
    if (this.blurHandler) {
      window.removeEventListener("blur", this.blurHandler);
    }
    this.stopAutoSync();
  }
  registerEvents() {
    this.debouncedSync = debounce(() => {
      if (this.settings.syncOnSave) {
        void this.triggerSync();
      }
    }, this.settings.debounceDelay * 1e3);
    this.registerEvent(this.app.vault.on("modify", () => {
      var _a;
      (_a = this.debouncedSync) == null ? void 0 : _a.call(this);
    }));
    this.registerEvent(this.app.vault.on("create", () => {
      var _a;
      (_a = this.debouncedSync) == null ? void 0 : _a.call(this);
    }));
    this.registerEvent(this.app.vault.on("delete", () => {
      var _a;
      (_a = this.debouncedSync) == null ? void 0 : _a.call(this);
    }));
    this.registerEvent(this.app.vault.on("rename", () => {
      var _a;
      (_a = this.debouncedSync) == null ? void 0 : _a.call(this);
    }));
    this.blurHandler = () => {
      if (this.settings.syncOnBlur) {
        void this.triggerSync();
      }
    };
    window.addEventListener("blur", this.blurHandler);
  }
  async triggerSync() {
    try {
      await this.syncEngine.syncLocalToCloud();
      const stats = this.syncEngine.getStats();
      new import_obsidian3.Notice(
        `\u2705 Sync complete \u2014 ${stats.filesCopied} files copied, ${stats.conflictsDetected} conflicts`,
        4e3
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      new import_obsidian3.Notice(`\u274C Sync failed: ${msg}`, 6e3);
    }
  }
  async triggerPull() {
    try {
      await this.syncEngine.syncCloudToLocal();
      const stats = this.syncEngine.getStats();
      new import_obsidian3.Notice(`\u2B07 Pull complete \u2014 ${stats.filesCopied} files pulled`, 4e3);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      new import_obsidian3.Notice(`\u274C Pull failed: ${msg}`, 6e3);
    }
  }
  openStatusModal() {
    new SyncStatusModal(
      this.app,
      this.syncEngine,
      this.fileUtils,
      () => {
        void this.triggerSync();
      },
      () => {
        void this.triggerPull();
      }
    ).open();
  }
  restartAutoSync() {
    this.stopAutoSync();
    const minutes = this.settings.autoSyncInterval;
    if (minutes > 0) {
      this.autoSyncTimer = setInterval(() => {
        void this.triggerSync();
      }, minutes * 60 * 1e3);
    }
  }
  stopAutoSync() {
    if (this.autoSyncTimer !== null) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    var _a, _b;
    await this.saveData(this.settings);
    (_a = this.syncEngine) == null ? void 0 : _a.updateSettings(this.settings);
    (_b = this.fileUtils) == null ? void 0 : _b.setVerbose(this.settings.verboseLogs);
    this.debouncedSync = debounce(() => {
      if (this.settings.syncOnSave) {
        void this.triggerSync();
      }
    }, this.settings.debounceDelay * 1e3);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {});
