import { Plugin, Notice, addIcon } from "obsidian";
import { ICloudMirrorSettings, DEFAULT_SETTINGS } from "./src/types";
import { FileUtils } from "./src/fileUtils";
import { ConflictResolver } from "./src/conflictResolver";
import { SyncEngine } from "./src/syncEngine";
import { ICloudMirrorSettingTab } from "./src/settings";
import { SyncStatusModal } from "./src/ui";

function debounce<T extends (...args: unknown[]) => void>(
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
  settings!: ICloudMirrorSettings;
  fileUtils!: FileUtils;
  conflictResolver!: ConflictResolver;
  syncEngine!: SyncEngine;

  private autoSyncTimer: ReturnType<typeof setInterval> | null = null;
  private debouncedSync: (() => void) | null = null;
  private blurHandler: (() => void) | null = null;

  async onload() {
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
      const adapter = this.app.vault.adapter as { basePath?: string };
      if (adapter?.basePath) {
        this.settings.localVaultPath = adapter.basePath;
      }
    }

    const syncEngineWithConfig = this.syncEngine as SyncEngine & {
      setConfigDir?: (configDir: string) => void;
    };
    syncEngineWithConfig.setConfigDir?.(this.app.vault.configDir);
    this.syncEngine.setStatusCallback((_status) => { /* used by UI modal */ });

    addIcon(
      "cloud-upload",
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>`
    );

    this.addRibbonIcon("cloud-upload", "iCloud Mirror: sync now", () => {
      void this.triggerSync();
    });

    this.addCommand({
      id: "sync-now",
      name: "Sync now (local → iCloud)",
      callback: () => { void this.triggerSync(); },
    });

    this.addCommand({
      id: "pull-from-icloud",
      name: "Pull from iCloud → local",
      callback: () => { void this.triggerPull(); },
    });

    this.addCommand({
      id: "open-status",
      name: "Open status panel",
      callback: () => this.openStatusModal(),
    });

    this.addSettingTab(new ICloudMirrorSettingTab(this.app, this));
    this.registerEvents();
    this.restartAutoSync();

    new Notice("iCloud Mirror loaded ✓", 3000);
  }

  onunload() {
    if (this.settings.syncOnClose) {
      void this.syncEngine.syncLocalToCloud().catch((e: unknown) => {
        console.error("[iCloud Mirror] Error on close sync:", e);
      });
    }
    if (this.blurHandler) {
      window.removeEventListener("blur", this.blurHandler);
    }
    this.stopAutoSync();
  }

  private registerEvents() {
    this.debouncedSync = debounce(() => {
      if (this.settings.syncOnSave) {
        void this.triggerSync();
      }
    }, this.settings.debounceDelay * 1000);

    this.registerEvent(this.app.vault.on("modify", () => { this.debouncedSync?.(); }));
    this.registerEvent(this.app.vault.on("create", () => { this.debouncedSync?.(); }));
    this.registerEvent(this.app.vault.on("delete", () => { this.debouncedSync?.(); }));
    this.registerEvent(this.app.vault.on("rename", () => { this.debouncedSync?.(); }));

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
      new Notice(
        `✅ Sync complete — ${stats.filesCopied} files copied, ${stats.conflictsDetected} conflicts`,
        4000
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      new Notice(`❌ Sync failed: ${msg}`, 6000);
    }
  }

  async triggerPull() {
    try {
      await this.syncEngine.syncCloudToLocal();
      const stats = this.syncEngine.getStats();
      new Notice(`⬇ Pull complete — ${stats.filesCopied} files pulled`, 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      new Notice(`❌ Pull failed: ${msg}`, 6000);
    }
  }

  openStatusModal() {
    new SyncStatusModal(
      this.app,
      this.syncEngine,
      this.fileUtils,
      () => { void this.triggerSync(); },
      () => { void this.triggerPull(); }
    ).open();
  }

  restartAutoSync() {
    this.stopAutoSync();
    const minutes = this.settings.autoSyncInterval;
    if (minutes > 0) {
      this.autoSyncTimer = setInterval(() => {
        void this.triggerSync();
      }, minutes * 60 * 1000);
    }
  }

  private stopAutoSync() {
    if (this.autoSyncTimer !== null) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as ICloudMirrorSettings;
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.syncEngine?.updateSettings(this.settings);
    this.fileUtils?.setVerbose(this.settings.verboseLogs);
    this.debouncedSync = debounce(() => {
      if (this.settings.syncOnSave) {
        void this.triggerSync();
      }
    }, this.settings.debounceDelay * 1000);
  }
}
