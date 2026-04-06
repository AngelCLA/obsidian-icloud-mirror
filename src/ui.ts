import { App, Modal } from "obsidian";
import { SyncEngine } from "./syncEngine";
import { FileUtils } from "./fileUtils";
import { SyncStatus } from "./types";

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

    contentEl.createEl("h2", { text: "iCloud Mirror — status" });

    const status = this.syncEngine.getStatus();
    const stats = this.syncEngine.getStats();

    // Status badge
    const badge = contentEl.createEl("div", {
      cls: "icm-status-badge",
      text: this.statusLabel(status),
    });
    badge.setCssProps({
      "background-color": this.statusColor(status),
    });

    // Stats grid
    const grid = contentEl.createEl("div", { cls: "icm-stats-grid" });

    this.statBox(grid, "Last sync", this.formatDate(stats.lastSync));
    this.statBox(grid, "Files copied", String(stats.filesCopied));
    this.statBox(grid, "Files skipped", String(stats.filesSkipped));
    this.statBox(grid, "Conflicts", String(stats.conflictsDetected));
    this.statBox(grid, "Deletions", String(stats.filesDeleted));
    this.statBox(grid, "Errors", String(stats.errors));

    // Action buttons
    const btnRow = contentEl.createEl("div", { cls: "icm-btn-row" });

    const syncBtn = btnRow.createEl("button", { text: "⬆ Sync now (local → iCloud)", cls: "icm-btn" });
    syncBtn.onclick = () => {
      this.onSyncNow();
      this.render();
    };

    const pullBtn = btnRow.createEl("button", { text: "⬇ Pull from iCloud", cls: "icm-btn" });
    pullBtn.onclick = () => {
      this.onPullFromCloud();
      this.render();
    };

    // Logs
    contentEl.createEl("h3", { text: "Recent logs" });
    const logContainer = contentEl.createEl("div", { cls: "icm-log-container" });

    const logs = this.fileUtils.getLogs().slice(-60).reverse();
    if (logs.length === 0) {
      logContainer.createEl("div", {
        text: "No logs yet.",
        cls: "icm-log-empty",
      });
    }
    for (const entry of logs) {
      const row = logContainer.createEl("div", { cls: "icm-log-row" });
      const colorClass = `icm-log-${entry.level}`;
      row.addClass(colorClass);
      const ts = entry.timestamp.toLocaleTimeString();
      row.textContent = `[${ts}] ${entry.level.toUpperCase()} — ${entry.message}`;
    }

    const clearBtn = contentEl.createEl("button", { text: "Clear logs", cls: "icm-btn icm-btn-sm" });
    clearBtn.onclick = () => {
      this.fileUtils.clearLogs();
      this.render();
    };
  }

  private statBox(parent: HTMLElement, label: string, value: string) {
    const box = parent.createEl("div", { cls: "icm-stat-box" });
    box.createEl("div", { text: value, cls: "icm-stat-value" });
    box.createEl("div", { text: label, cls: "icm-stat-label" });
  }

  private statusLabel(status: SyncStatus): string {
    const map: Record<SyncStatus, string> = {
      idle: "⏸ Idle",
      syncing: "🔄 Syncing…",
      success: "✅ Success",
      conflict: "⚠️ Conflict detected",
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
