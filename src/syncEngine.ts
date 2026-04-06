import * as fs from "fs";
import * as path from "path";
import { ICloudMirrorSettings, SyncDirection, SyncStats, SyncStatus } from "./types";
import { FileUtils } from "./fileUtils";
import { ConflictResolver } from "./conflictResolver";

export type StatusChangeCallback = (status: SyncStatus, stats: SyncStats) => void;

export class SyncEngine {
  private running = false;
  private stats: SyncStats = {
    lastSync: null,
    filesCopied: 0,
    filesSkipped: 0,
    filesDeleted: 0,
    conflictsDetected: 0,
    errors: 0,
  };
  private status: SyncStatus = "idle";
  private onStatusChange: StatusChangeCallback | null = null;

  constructor(
    private settings: ICloudMirrorSettings,
    private fileUtils: FileUtils,
    private conflictResolver: ConflictResolver
  ) {}

  setStatusCallback(cb: StatusChangeCallback) {
    this.onStatusChange = cb;
  }

  updateSettings(settings: ICloudMirrorSettings) {
    this.settings = settings;
  }

  getStats(): SyncStats {
    return { ...this.stats };
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  private setStatus(status: SyncStatus) {
    this.status = status;
    this.onStatusChange?.(status, this.getStats());
  }

  isReady(): boolean {
    const { localVaultPath, icloudMirrorPath } = this.settings;
    return (
      !!localVaultPath &&
      !!icloudMirrorPath &&
      this.fileUtils.pathExists(localVaultPath)
    );
  }

  /**
   * Main sync: Local → iCloud (primary direction)
   */
  async syncLocalToCloud(): Promise<void> {
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
      errors: 0,
    };

    try {
      this.fileUtils.info(
        `Starting sync: ${localVaultPath} → ${icloudMirrorPath}`
      );
      this.fileUtils.ensureDir(icloudMirrorPath);

      const localFiles = this.fileUtils.listFiles(
        localVaultPath,
        this.settings.excludedFolders,
        this.settings.excludedFiles,
        this.settings.syncObsidianFolder
      );

      for (const relPath of localFiles) {
        const srcAbs = path.join(localVaultPath, relPath);
        const destAbs = path.join(icloudMirrorPath, relPath);

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
            // In Safe Mode: backup dest, then copy src over
            await this.conflictResolver.backup(destAbs);
            await this.fileUtils.copyFile(srcAbs, destAbs);
            sessionStats.copied++;
          } else {
            this.fileUtils.debug(`Copy: ${relPath}`);
            await this.fileUtils.copyFile(srcAbs, destAbs);
            sessionStats.copied++;
          }
        } catch (err: any) {
          this.fileUtils.error(`Error processing ${relPath}: ${err.message}`);
          sessionStats.errors++;
        }
      }

      // Mirror Mode: delete files in dest that don't exist in src
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
            const destAbs = path.join(icloudMirrorPath, relPath);
            this.fileUtils.info(`Mirror delete: ${relPath}`);
            try {
              this.fileUtils.deleteFile(destAbs);
              sessionStats.deleted++;
            } catch (err: any) {
              this.fileUtils.error(
                `Failed to delete ${relPath}: ${err.message}`
              );
              sessionStats.errors++;
            }
          }
        }
      }

      // Update stats
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
    } catch (err: any) {
      this.fileUtils.error(`Sync failed: ${err.message}`);
      this.setStatus("error");
      this.stats.errors++;
    } finally {
      this.running = false;
    }
  }

  /**
   * Pull: iCloud → Local (manual only)
   */
  async syncCloudToLocal(): Promise<void> {
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
      errors: 0,
    };

    try {
      if (!this.fileUtils.pathExists(icloudMirrorPath)) {
        this.fileUtils.warn("iCloud mirror path does not exist.");
        this.setStatus("error");
        return;
      }

      this.fileUtils.info(
        `Pulling: ${icloudMirrorPath} → ${localVaultPath}`
      );

      const cloudFiles = this.fileUtils.listFiles(
        icloudMirrorPath,
        this.settings.excludedFolders,
        this.settings.excludedFiles,
        this.settings.syncObsidianFolder
      );

      for (const relPath of cloudFiles) {
        const srcAbs = path.join(icloudMirrorPath, relPath);
        const destAbs = path.join(localVaultPath, relPath);

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
        } catch (err: any) {
          this.fileUtils.error(`Error pulling ${relPath}: ${err.message}`);
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
    } catch (err: any) {
      this.fileUtils.error(`Pull failed: ${err.message}`);
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
      errors: 0,
    };
  }
}
