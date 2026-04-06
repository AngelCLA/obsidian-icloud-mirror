import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { FileEntry, LogEntry } from "./types";

export class FileUtils {
  private logs: LogEntry[] = [];
  private verbose: boolean = false;
  private configDir: string = ".obsidian";

  setVerbose(v: boolean) {
    this.verbose = v;
  }

  setConfigDir(dir: string) {
    this.configDir = dir;
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
  }

  private log(
    level: LogEntry["level"],
    message: string
  ) {
    const entry: LogEntry = { timestamp: new Date(), level, message };
    this.logs.push(entry);
    if (this.logs.length > 1000) this.logs.shift();
    if (level === "debug" && !this.verbose) return;
    const prefix = `[iCloud Mirror] [${level.toUpperCase()}]`;
    if (level === "error") console.error(prefix, message);
    else if (level === "warn") console.warn(prefix, message);
    else console.debug(prefix, message);
  }

  info(msg: string) { this.log("info", msg); }
  warn(msg: string) { this.log("warn", msg); }
  error(msg: string) { this.log("error", msg); }
  debug(msg: string) { this.log("debug", msg); }

  /**
   * Compute MD5 hash of a file for conflict detection
   */
  async computeHash(filePath: string): Promise<string | null> {
    try {
      const hash = crypto.createHash("md5");
      const stream = fs.createReadStream(filePath);
      return await new Promise((resolve, reject) => {
        stream.on("data", (chunk) => hash.update(chunk));
        stream.on("end", () => resolve(hash.digest("hex")));
        stream.on("error", reject);
      });
    } catch {
      return null;
    }
  }

  /**
   * Get a FileEntry (stat + optional hash) for a path
   */
  async getFileEntry(
    absolutePath: string,
    relativePath: string,
    withHash = false
  ): Promise<FileEntry | null> {
    try {
      const stat = fs.statSync(absolutePath);
      const entry: FileEntry = {
        relativePath,
        absolutePath,
        mtime: stat.mtimeMs,
        size: stat.size,
      };
      if (withHash) {
        entry.hash = (await this.computeHash(absolutePath)) ?? undefined;
      }
      return entry;
    } catch {
      return null;
    }
  }

  /**
   * Recursively list all files in a directory, returning relative paths
   */
  listFiles(
    dir: string,
    excludedFolders: string[],
    excludedFiles: string[],
    syncObsidian: boolean
  ): string[] {
    const results: string[] = [];

    if (!fs.existsSync(dir)) return results;

    const walk = (current: string, rel: string) => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        this.warn(`Cannot read directory: ${current}`);
        return;
      }

      for (const entry of entries) {
        const relPath = rel ? `${rel}/${entry.name}` : entry.name;
        const absPath = path.join(current, entry.name);

        // Skip config folder if not configured
        if (!syncObsidian && (entry.name === this.configDir || relPath.startsWith(this.configDir + "/"))) {
          continue;
        }

        if (entry.isDirectory()) {
          // Check excluded folders
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

  private matchesExcludedFolder(relPath: string, excluded: string[]): boolean {
    return excluded.some((ex) => {
      const norm = ex.replace(/\\/g, "/").replace(/^\//, "").replace(/\/$/, "");
      return relPath === norm || relPath.startsWith(norm + "/");
    });
  }

  private matchesExcludedFile(relPath: string, excluded: string[]): boolean {
    return excluded.some((ex) => {
      if (ex.includes("*")) {
        // Glob-like: *.tmp, *.lock
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
  async copyFile(src: string, dest: string): Promise<void> {
    const destDir = path.dirname(dest);
    fs.mkdirSync(destDir, { recursive: true });

    await fs.promises.copyFile(src, dest);

    // Preserve mtime
    try {
      const stat = fs.statSync(src);
      fs.utimesSync(dest, stat.atime, stat.mtime);
    } catch {
      // Non-critical
    }
  }

  /**
   * Generate a conflict backup filename
   */
  conflictPath(destPath: string): string {
    const ext = path.extname(destPath);
    const base = destPath.slice(0, destPath.length - ext.length);
    const ts = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "-")
      .slice(0, 19);
    return `${base}-conflict-${ts}${ext}`;
  }

  /**
   * Safely delete a file (used only in Mirror Mode)
   */
  deleteFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * Check if two files are identical by size + mtime (fast) then hash (thorough)
   */
  async areFilesIdentical(a: string, b: string): Promise<boolean> {
    try {
      const sa = fs.statSync(a);
      const sb = fs.statSync(b);
      if (sa.size !== sb.size) return false;
      // If mtime within 2s, treat as same (FAT/iCloud may round)
      if (Math.abs(sa.mtimeMs - sb.mtimeMs) < 2000) return true;
      // Different mtime but same size: check hash
      const ha = await this.computeHash(a);
      const hb = await this.computeHash(b);
      return ha !== null && ha === hb;
    } catch {
      return false;
    }
  }

  pathExists(p: string): boolean {
    return fs.existsSync(p);
  }

  ensureDir(dir: string): void {
    fs.mkdirSync(dir, { recursive: true });
  }
}
