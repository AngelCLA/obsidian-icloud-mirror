import {
  Plugin,
  Notice,
  addIcon,
  WorkspaceLeaf,
} from "obsidian";
import * as path from "path";
import { ICloudMirrorSettings, DEFAULT_SETTINGS } from "./src/types";
import { FileUtils } from "./src/fileUtils";
import { ConflictResolver } from "./src/conflictResolver";
import { SyncEngine } from "./src/syncEngine";
import { ICloudMirrorSettingTab } from "./src/settings";
import { SyncStatusModal } from "./src/ui";

// Simple debounce utility
function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delayMs);
  };
}

export default class ICloudMirrorPlugin extends Plugin {
  settings: ICloudMirrorSettings;
  fileUtils: FileUtils;
  conflictResolver: ConflictResolver;
  syncEngine: SyncEngine;

  private autoSyncTimer: ReturnType<typeof setInterval> | null = null;
  private debouncedSync: (() => void) | null = null;
  private blurHandler: (() => void) | null = null;

  async onload() {
    console.log("[iCloud Mirror] Loading plugin…");

    await this.loadSettings();

    this.fileUtils = new FileUtils();
    this.fileUtils.setVerbose(this.settings.verboseLogs);

    this.conflictResolver = new ConflictResolver(this.fileUtils);
    this.syncEngine = new SyncEngine(
      this.settings,
      this.fileUtils,
      this.conflictResolver
    );

    // Resolve local vault path: use Obsidian's adapter basePath if not set
    if (!this.settings.localVaultPath) {
      const adapter = this.app.vault.adapter as any;
      if (adapter?.basePath) {
        this.settings.localVaultPath = adapter.basePath;
        this.fileUtils.info(
          `Using vault base path: ${this.settings.localVaultPath}`
        );
      }
    }

    // Status callback
    this.syncEngine.setStatusCallback((status, stats) => {
      this.updateRibbonTooltip(status);
    });

    // Ribbon icon
    addIcon(
      "cloud-upload",
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>`
    );

    const ribbonIcon = this.addRibbonIcon(
      "cloud-upload",
      "iCloud Mirror: Sync Now",
      () => {
        this.triggerSync();
      }
    );

    // Commands
    this.addCommand({
      id: "sync-now",
      name: "Sync Now (Local → iCloud)",
      callback: () => this.triggerSync(),
    });

    this.addCommand({
      id: "pull-from-icloud",
      name: "Pull from iCloud → Local",
      callback: () => this.triggerPull(),
    });

    this.addCommand({
      id: "open-status",
      name: "Open Status Panel",
      callback: () => this.openStatusModal(),
    });

    // Settings tab
    this.addSettingTab(new ICloudMirrorSettingTab(this.app, this));

    // Events
    this.registerEvents();

    // Auto-sync timer
    this.restartAutoSync();

    this.fileUtils.info("Plugin loaded.");
    new Notice("iCloud Mirror loaded ✓", 3000);
  }

  private updateRibbonTooltip(status: string) {
    // Ribbon tooltip updates are reflected via the icon title attribute
  }

  private registerEvents() {
    // ── Save event (debounced) ─────────────────────────────────────────
    this.debouncedSync = debounce(() => {
      if (this.settings.syncOnSave) {
        this.fileUtils.info("Sync triggered: file saved.");
        this.triggerSync();
      }
    }, this.settings.debounceDelay * 1000);

    this.registerEvent(
      this.app.vault.on("modify", (_file) => {
        this.debouncedSync?.();
      })
    );

    this.registerEvent(
      this.app.vault.on("create", (_file) => {
        this.debouncedSync?.();
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", (_file) => {
        this.debouncedSync?.();
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", (_file, _oldPath) => {
        this.debouncedSync?.();
      })
    );

    // ── Window blur (lose focus) ───────────────────────────────────────
    // Obsidian doesn't have a direct blur API; we listen on the window object.
    this.blurHandler = () => {
      if (this.settings.syncOnBlur) {
        this.fileUtils.info("Sync triggered: window lost focus.");
        this.triggerSync();
      }
    };
    window.addEventListener("blur", this.blurHandler);
  }

  async onunload() {
    // ── Sync on close ──────────────────────────────────────────────────
    if (this.settings.syncOnClose) {
      this.fileUtils.info("Sync triggered: Obsidian closing.");
      try {
        await this.syncEngine.syncLocalToCloud();
      } catch (e) {
        console.error("[iCloud Mirror] Error on close sync:", e);
      }
    }

    // Cleanup
    if (this.blurHandler) {
      window.removeEventListener("blur", this.blurHandler);
    }
    this.stopAutoSync();
    this.fileUtils.info("Plugin unloaded.");
  }

  // ── Public helpers ──────────────────────────────────────────────────────

  async triggerSync() {
    try {
      await this.syncEngine.syncLocalToCloud();
      const stats = this.syncEngine.getStats();
      new Notice(
        `✅ Sync complete — ${stats.filesCopied} files copied, ${stats.conflictsDetected} conflicts`,
        4000
      );
    } catch (err: any) {
      new Notice(`❌ Sync failed: ${err.message}`, 6000);
    }
  }

  async triggerPull() {
    try {
      await this.syncEngine.syncCloudToLocal();
      const stats = this.syncEngine.getStats();
      new Notice(
        `⬇ Pull complete — ${stats.filesCopied} files pulled`,
        4000
      );
    } catch (err: any) {
      new Notice(`❌ Pull failed: ${err.message}`, 6000);
    }
  }

  openStatusModal() {
    new SyncStatusModal(
      this.app,
      this.syncEngine,
      this.fileUtils,
      () => this.triggerSync(),
      () => this.triggerPull()
    ).open();
  }

  restartAutoSync() {
    this.stopAutoSync();
    const minutes = this.settings.autoSyncInterval;
    if (minutes > 0) {
      this.autoSyncTimer = setInterval(() => {
        this.fileUtils.info(`Auto-sync triggered (every ${minutes} min).`);
        this.triggerSync();
      }, minutes * 60 * 1000);
      this.fileUtils.info(`Auto-sync scheduled every ${minutes} minute(s).`);
    }
  }

  private stopAutoSync() {
    if (this.autoSyncTimer !== null) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Propagate updated settings to engine and utils
    this.syncEngine?.updateSettings(this.settings);
    this.fileUtils?.setVerbose(this.settings.verboseLogs);
    // Rebuild debounced sync with updated delay
    if (this.debouncedSync !== null) {
      this.debouncedSync = debounce(() => {
        if (this.settings.syncOnSave) {
          this.triggerSync();
        }
      }, this.settings.debounceDelay * 1000);
    }
  }
}
