import { App, Modal, Setting } from "obsidian";
import { SyncEngine } from "./syncEngine";
import { FileUtils } from "./fileUtils";
import { SyncStatus, SyncStats } from "./types";

export class SyncStatusModal extends Modal {
  private refreshInterval: number | null = null;

  constructor(
    app: App,
    private syncEngine: SyncEngine,
    private fileUtils: FileUtils,
    private onSyncNow: () => void,
    private onPullFromCloud: () => void
  ) {
    super(app);
  }

  onOpen() {
    this.render();
    // Refresh every 2 seconds while open
    this.refreshInterval = window.setInterval(() => this.render(), 2000);
  }

  onClose() {
    if (this.refreshInterval !== null) {
      clearInterval(this.refreshInterval);
    }
  }

  private render() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "iCloud Mirror — Status" });

    const status = this.syncEngine.getStatus();
    const stats = this.syncEngine.getStats();

    // Status badge
    const badge = contentEl.createEl("div", {
      cls: "icm-status-badge",
      text: this.statusLabel(status),
    });
    badge.style.cssText = `
      display: inline-block;
      padding: 4px 14px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 16px;
      background: ${this.statusColor(status)};
      color: white;
    `;

    // Stats grid
    const grid = contentEl.createEl("div");
    grid.style.cssText =
      "display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;";

    this.statBox(grid, "Last Sync", this.formatDate(stats.lastSync));
    this.statBox(grid, "Files Copied", String(stats.filesCopied));
    this.statBox(grid, "Files Skipped", String(stats.filesSkipped));
    this.statBox(grid, "Conflicts", String(stats.conflictsDetected));
    this.statBox(grid, "Deletions", String(stats.filesDeleted));
    this.statBox(grid, "Errors", String(stats.errors));

    // Action buttons
    const btnRow = contentEl.createEl("div");
    btnRow.style.cssText = "display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;";

    const syncBtn = btnRow.createEl("button", { text: "⬆ Sync Now (Local → iCloud)" });
    syncBtn.style.cssText = "padding: 6px 14px; cursor: pointer;";
    syncBtn.onclick = () => {
      this.onSyncNow();
      this.render();
    };

    const pullBtn = btnRow.createEl("button", { text: "⬇ Pull from iCloud" });
    pullBtn.style.cssText = "padding: 6px 14px; cursor: pointer;";
    pullBtn.onclick = () => {
      this.onPullFromCloud();
      this.render();
    };

    // Logs
    contentEl.createEl("h3", { text: "Recent Logs" });
    const logContainer = contentEl.createEl("div");
    logContainer.style.cssText =
      "background: var(--background-secondary); border-radius: 6px; padding: 10px; max-height: 250px; overflow-y: auto; font-family: monospace; font-size: 12px;";

    const logs = this.fileUtils.getLogs().slice(-60).reverse();
    if (logs.length === 0) {
      logContainer.createEl("div", {
        text: "No logs yet.",
        cls: "icm-log-empty",
      });
    }
    for (const entry of logs) {
      const row = logContainer.createEl("div");
      row.style.cssText = `
        padding: 2px 0;
        color: ${this.logColor(entry.level)};
        border-bottom: 1px solid var(--background-modifier-border);
      `;
      const ts = entry.timestamp.toLocaleTimeString();
      row.textContent = `[${ts}] ${entry.level.toUpperCase()} — ${entry.message}`;
    }

    const clearBtn = contentEl.createEl("button", { text: "Clear Logs" });
    clearBtn.style.cssText = "margin-top: 8px; padding: 4px 10px; cursor: pointer;";
    clearBtn.onclick = () => {
      this.fileUtils.clearLogs();
      this.render();
    };
  }

  private statBox(parent: HTMLElement, label: string, value: string) {
    const box = parent.createEl("div");
    box.style.cssText =
      "background: var(--background-secondary); border-radius: 6px; padding: 10px; text-align: center;";
    box.createEl("div", { text: value }).style.cssText =
      "font-size: 20px; font-weight: 700;";
    box.createEl("div", { text: label }).style.cssText =
      "font-size: 11px; color: var(--text-muted); margin-top: 2px;";
  }

  private statusLabel(status: SyncStatus): string {
    const map: Record<SyncStatus, string> = {
      idle: "⏸ Idle",
      syncing: "🔄 Syncing…",
      success: "✅ Success",
      conflict: "⚠️ Conflict Detected",
      error: "❌ Error",
      disabled: "⛔ Disabled",
    };
    return map[status] ?? status;
  }

  private statusColor(status: SyncStatus): string {
    const map: Record<SyncStatus, string> = {
      idle: "#666",
      syncing: "#4a90e2",
      success: "#27ae60",
      conflict: "#e67e22",
      error: "#e74c3c",
      disabled: "#999",
    };
    return map[status] ?? "#666";
  }

  private logColor(level: string): string {
    if (level === "error") return "var(--color-red)";
    if (level === "warn") return "var(--color-yellow)";
    if (level === "debug") return "var(--text-muted)";
    return "var(--text-normal)";
  }

  private formatDate(d: Date | null): string {
    if (!d) return "Never";
    return d.toLocaleTimeString();
  }
}
