import * as fs from "fs";
import { FileUtils } from "./fileUtils";
import { SyncConflict } from "./types";

export class ConflictResolver {
  constructor(private fileUtils: FileUtils) {}

  /**
   * Determine if src should overwrite dest.
   * Returns:
   *   "copy"     → src is newer/different, safe to copy
   *   "skip"     → dest is identical, skip
   *   "conflict" → dest is newer than src (potential data loss)
   */
  async evaluate(
    srcPath: string,
    destPath: string,
    relativePath: string
  ): Promise<{
    action: "copy" | "skip" | "conflict";
    conflict?: SyncConflict;
  }> {
    if (!fs.existsSync(destPath)) {
      return { action: "copy" };
    }

    const identical = await this.fileUtils.areFilesIdentical(srcPath, destPath);
    if (identical) {
      return { action: "skip" };
    }

    const srcStat = fs.statSync(srcPath);
    const destStat = fs.statSync(destPath);

    // If dest is newer than src → conflict
    if (destStat.mtimeMs > srcStat.mtimeMs + 2000) {
      return {
        action: "conflict",
        conflict: {
          relativePath,
          localMtime: srcStat.mtimeMs,
          remoteMtime: destStat.mtimeMs,
          localSize: srcStat.size,
          remoteSize: destStat.size,
        },
      };
    }

    // src is newer (or same time but different) → copy
    return { action: "copy" };
  }

  /**
   * Create a safe backup of dest before overwriting, so data is never lost.
   */
  async backup(destPath: string): Promise<string> {
    const backupPath = this.fileUtils.conflictPath(destPath);
    await this.fileUtils.copyFile(destPath, backupPath);
    this.fileUtils.warn(
      `Conflict backup created: ${backupPath}`
    );
    return backupPath;
  }
}
