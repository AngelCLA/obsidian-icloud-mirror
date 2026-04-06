import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import ICloudMirrorPlugin from "../main";

export class ICloudMirrorSettingTab extends PluginSettingTab {
  plugin: ICloudMirrorPlugin;

  constructor(app: App, plugin: ICloudMirrorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "iCloud Mirror — Settings" });

    // ── Paths ─────────────────────────────────────────────────────────────
    containerEl.createEl("h3", { text: "📁 Paths" });

    new Setting(containerEl)
      .setName("Local vault path")
      .setDesc(
        "Absolute path to your local working vault (e.g. D:\\ObsidianVault). Leave blank to use the current vault path."
      )
      .addText((text) =>
        text
          .setPlaceholder("D:\\ObsidianVault")
          .setValue(this.plugin.settings.localVaultPath)
          .onChange(async (value) => {
            this.plugin.settings.localVaultPath = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("iCloud mirror path")
      .setDesc(
        "Absolute path to the iCloud Drive folder that your iPhone reads (e.g. C:\\Users\\You\\iCloudDrive\\ObsidianVault_iPhone)."
      )
      .addText((text) =>
        text
          .setPlaceholder("C:\\Users\\You\\iCloudDrive\\ObsidianVault_iPhone")
          .setValue(this.plugin.settings.icloudMirrorPath)
          .onChange(async (value) => {
            this.plugin.settings.icloudMirrorPath = value.trim();
            await this.plugin.saveSettings();
          })
      );

    // ── Sync triggers ──────────────────────────────────────────────────────
    containerEl.createEl("h3", { text: "⚡ Sync Triggers" });

    new Setting(containerEl)
      .setName("Sync on file save")
      .setDesc("Sync after a note is saved (with debounce delay).")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncOnSave)
          .onChange(async (value) => {
            this.plugin.settings.syncOnSave = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Sync when Obsidian loses focus")
      .setDesc("Sync when you switch away from Obsidian.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncOnBlur)
          .onChange(async (value) => {
            this.plugin.settings.syncOnBlur = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Sync on Obsidian close")
      .setDesc("Sync before Obsidian closes.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncOnClose)
          .onChange(async (value) => {
            this.plugin.settings.syncOnClose = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Auto-sync interval (minutes)")
      .setDesc("0 to disable periodic sync.")
      .addSlider((slider) =>
        slider
          .setLimits(0, 60, 1)
          .setValue(this.plugin.settings.autoSyncInterval)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.autoSyncInterval = value;
            await this.plugin.saveSettings();
            this.plugin.restartAutoSync();
          })
      );

    new Setting(containerEl)
      .setName("Debounce delay (seconds)")
      .setDesc(
        "Wait this many seconds after last save before syncing. Prevents syncing while actively writing."
      )
      .addSlider((slider) =>
        slider
          .setLimits(1, 30, 1)
          .setValue(this.plugin.settings.debounceDelay)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.debounceDelay = value;
            await this.plugin.saveSettings();
          })
      );

    // ── Exclusions ─────────────────────────────────────────────────────────
    containerEl.createEl("h3", { text: "🚫 Exclusions" });

    new Setting(containerEl)
      .setName("Excluded folders")
      .setDesc(
        "One per line. Relative paths like .trash, node_modules, .git"
      )
      .addTextArea((text) => {
        text
          .setPlaceholder(".trash\nnode_modules\n.git")
          .setValue(this.plugin.settings.excludedFolders.join("\n"))
          .onChange(async (value) => {
            this.plugin.settings.excludedFolders = value
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean);
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 5;
        text.inputEl.style.width = "100%";
      });

    new Setting(containerEl)
      .setName("Excluded files")
      .setDesc(
        "One per line. Supports glob patterns like *.tmp or exact paths like .obsidian/workspace.json"
      )
      .addTextArea((text) => {
        text
          .setPlaceholder(
            ".obsidian/workspace.json\n.obsidian/cache\n*.tmp\n*.lock"
          )
          .setValue(this.plugin.settings.excludedFiles.join("\n"))
          .onChange(async (value) => {
            this.plugin.settings.excludedFiles = value
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean);
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 5;
        text.inputEl.style.width = "100%";
      });

    new Setting(containerEl)
      .setName("Sync .obsidian folder")
      .setDesc(
        "Include the .obsidian config folder in sync. Recommended: OFF — themes/plugins may be incompatible between desktop and iPhone."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncObsidianFolder)
          .onChange(async (value) => {
            this.plugin.settings.syncObsidianFolder = value;
            await this.plugin.saveSettings();
          })
      );

    // ── Safety ─────────────────────────────────────────────────────────────
    containerEl.createEl("h3", { text: "🛡️ Safety" });

    new Setting(containerEl)
      .setName("Safe Mode")
      .setDesc(
        "Only adds/updates files. Never deletes from the mirror. Strongly recommended."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.safeMode)
          .onChange(async (value) => {
            this.plugin.settings.safeMode = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Mirror Mode (deletes in mirror)")
      .setDesc(
        "⚠️ When enabled AND Safe Mode is OFF, deletions in your local vault are mirrored to iCloud. Use with caution."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.mirrorMode)
          .onChange(async (value) => {
            if (value && this.plugin.settings.safeMode) {
              new Notice(
                "Mirror Mode requires Safe Mode to be OFF. Disable Safe Mode first.",
                5000
              );
              toggle.setValue(false);
              return;
            }
            this.plugin.settings.mirrorMode = value;
            await this.plugin.saveSettings();
          })
      );

    // ── Logging ────────────────────────────────────────────────────────────
    containerEl.createEl("h3", { text: "🪵 Logging" });

    new Setting(containerEl)
      .setName("Verbose logs")
      .setDesc("Log every file checked (not just copies). Useful for debugging.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.verboseLogs)
          .onChange(async (value) => {
            this.plugin.settings.verboseLogs = value;
            await this.plugin.saveSettings();
          })
      );

    // ── Actions ────────────────────────────────────────────────────────────
    containerEl.createEl("h3", { text: "🔧 Manual Actions" });

    new Setting(containerEl)
      .setName("Reset session stats")
      .setDesc("Reset the file/conflict counters.")
      .addButton((btn) =>
        btn.setButtonText("Reset").onClick(() => {
          this.plugin.syncEngine.resetSessionStats();
          new Notice("Stats reset.");
        })
      );
  }
}
