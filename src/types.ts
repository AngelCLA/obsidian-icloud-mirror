export interface ICloudMirrorSettings {
  localVaultPath: string;
  icloudMirrorPath: string;
  syncOnSave: boolean;
  syncOnBlur: boolean;
  syncOnClose: boolean;
  autoSyncInterval: number; // minutes, 0 = disabled
  excludedFolders: string[];
  excludedFiles: string[];
  syncObsidianFolder: boolean;
  safeMode: boolean;
  mirrorMode: boolean;
  verboseLogs: boolean;
  debounceDelay: number; // seconds
}

export const DEFAULT_SETTINGS: ICloudMirrorSettings = {
  localVaultPath: "",
  icloudMirrorPath: "",
  syncOnSave: true,
  syncOnBlur: true,
  syncOnClose: true,
  autoSyncInterval: 0,
  excludedFolders: [
    ".trash",
    "node_modules",
    ".git",
  ],
  excludedFiles: [
    "workspace.json",
    "workspaces.json",
    "cache",
    ".DS_Store",
    "Thumbs.db",
    "desktop.ini",
    "*.tmp",
    "*.lock",
  ],
  syncObsidianFolder: false,
  safeMode: true,
  mirrorMode: false,
  verboseLogs: false,
  debounceDelay: 5,
};

export type SyncStatus =
  | "idle"
  | "syncing"
  | "success"
  | "conflict"
  | "error"
  | "disabled";

export interface SyncStats {
  lastSync: Date | null;
  filesCopied: number;
  filesSkipped: number;
  filesDeleted: number;
  conflictsDetected: number;
  errors: number;
}

export interface FileEntry {
  relativePath: string;
  absolutePath: string;
  mtime: number;
  size: number;
  hash?: string;
}

export interface SyncConflict {
  relativePath: string;
  localMtime: number;
  remoteMtime: number;
  localSize: number;
  remoteSize: number;
  resolvedPath?: string;
}

export interface LogEntry {
  timestamp: Date;
  level: "info" | "warn" | "error" | "debug";
  message: string;
}

export type SyncDirection = "localToCloud" | "cloudToLocal" | "bidirectional";
