/**
 * Tauri File System Service
 * Handles all file I/O operations using Tauri's FS and Dialog plugins.
 * This is the Tauri-native counterpart of FileSystemService (browser).
 */

import { open } from '@tauri-apps/plugin-dialog';
import {
  readTextFile,
  writeTextFile,
  readFile as tauriReadBinaryFile,
  writeFile as tauriWriteBinaryFile,
  mkdir,
  readDir,
  remove,
  exists as fsExists,
  BaseDirectory,
} from '@tauri-apps/plugin-fs';
import { appDataDir } from '@tauri-apps/api/path';
import { IFileSystemService } from '@/types';

const LS_WORKSPACE_PATH = 'tauri-workspace-path';

/** Detect Android or iOS runtime (Tauri mobile) */
function isMobilePlatform(): boolean {
  return /android/i.test(navigator.userAgent) ||
    (/iPad|iPhone|iPod/.test(navigator.userAgent));
}

export class TauriFileSystemService implements IFileSystemService {
  private rootPath: string | null = null;

  /**
   * Request access to a directory.
   * On mobile: auto-provision app-private storage.
   * On desktop: show native folder picker dialog.
   */
  async requestDirectoryAccess(): Promise<string> {
    if (isMobilePlatform()) {
      return this.provisionMobileWorkspace();
    }

    const selected = await open({ directory: true, multiple: false });
    if (!selected) {
      throw new Error('No directory selected');
    }
    const dirPath = selected as string;
    this.rootPath = dirPath;
    localStorage.setItem(LS_WORKSPACE_PATH, dirPath);
    return dirPath;
  }

  /**
   * Request directory access using only the native folder picker.
   * Returns null if picker is not available or user cancels.
   */
  async requestDirectoryWithPicker(): Promise<string | null> {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected) {
        const dirPath = selected as string;
        this.rootPath = dirPath;
        localStorage.setItem(LS_WORKSPACE_PATH, dirPath);
        return dirPath;
      }
    } catch {
      // Picker not available
    }
    return null;
  }

  /**
   * Create workspace inside app-private storage for mobile platforms.
   * Uses $APPDATA which needs no special Android permissions.
   */
  private async provisionMobileWorkspace(): Promise<string> {
    const dataDir = await appDataDir();
    // Ensure the workspace subdirectory exists using BaseDirectory
    // (avoids scope issues with raw paths on Android)
    try {
      await mkdir('workspace', { baseDir: BaseDirectory.AppData, recursive: true });
    } catch {
      // Directory may already exist — that's fine
    }
    this.rootPath = dataDir;
    localStorage.setItem(LS_WORKSPACE_PATH, dataDir);
    return dataDir;
  }

  /**
   * Attempt to restore file system access from a previously saved path.
   */
  async tryRestore(): Promise<'granted' | 'prompt' | 'denied'> {
    try {
      // On mobile, auto-provision if no saved path
      if (isMobilePlatform()) {
        const saved = localStorage.getItem(LS_WORKSPACE_PATH);
        if (saved) {
          this.rootPath = saved;
          return 'granted';
        }
        // Auto-provision on first launch
        await this.provisionMobileWorkspace();
        return 'granted';
      }

      const saved = localStorage.getItem(LS_WORKSPACE_PATH);
      if (!saved) return 'denied';

      // Verify the path still exists
      const pathExists = await fsExists(saved);
      if (pathExists) {
        this.rootPath = saved;
        return 'granted';
      }
      return 'denied';
    } catch {
      return 'denied';
    }
  }

  /**
   * Re-request permission (in Tauri, access is always granted for valid paths)
   */
  async requestRestoredPermission(): Promise<boolean> {
    const saved = localStorage.getItem(LS_WORKSPACE_PATH);
    if (!saved) return false;

    try {
      const pathExists = await fsExists(saved);
      if (pathExists) {
        this.rootPath = saved;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get the current root path (used for truthiness checks by configService)
   */
  getRootHandle(): string | null {
    return this.rootPath;
  }

  /**
   * Set the root path
   */
  setRootHandle(path: string): void {
    this.rootPath = path;
    localStorage.setItem(LS_WORKSPACE_PATH, path);
  }

  private resolvePath(relativePath: string): string {
    if (!this.rootPath) {
      throw new Error('No root directory selected');
    }
    return `${this.rootPath}/${relativePath}`;
  }

  /**
   * Read a file from the file system
   */
  async readFile(path: string): Promise<string> {
    return await readTextFile(this.resolvePath(path));
  }

  /**
   * Write content to a file
   */
  async writeFile(path: string, content: string): Promise<void> {
    await writeTextFile(this.resolvePath(path), content);
  }

  /**
   * Create a directory (recursively)
   */
  async createDirectory(path: string): Promise<void> {
    await mkdir(this.resolvePath(path), { recursive: true });
  }

  /**
   * List all entries in a directory
   */
  async listDirectory(
    path: string = ''
  ): Promise<Array<{ name: string; kind: 'file' | 'directory' }>> {
    const fullPath = path === '' ? this.rootPath! : this.resolvePath(path);
    const entries = await readDir(fullPath);

    return entries.map((entry) => ({
      name: entry.name,
      kind: entry.isDirectory ? 'directory' : 'file',
    }));
  }

  /**
   * Delete a file or directory
   */
  async delete(path: string): Promise<void> {
    await remove(this.resolvePath(path), { recursive: true });
  }

  /**
   * Check if a file or directory exists
   */
  async exists(path: string): Promise<boolean> {
    return await fsExists(this.resolvePath(path));
  }

  async writeBinaryFile(path: string, data: Uint8Array): Promise<void> {
    await tauriWriteBinaryFile(this.resolvePath(path), data);
  }

  async readBinaryFile(path: string): Promise<Uint8Array> {
    return await tauriReadBinaryFile(this.resolvePath(path));
  }

  /**
   * Recursively scan a directory and return all page paths
   * NEW: Scans for .md files instead of directories with index.md
   */
  async scanPages(path: string = 'workspace'): Promise<string[]> {
    const pagePaths: string[] = [];

    const scanDir = async (dirPath: string): Promise<void> => {
      const entries = await this.listDirectory(dirPath);

      for (const entry of entries) {
        const fullPath = dirPath ? `${dirPath}/${entry.name}` : entry.name;

        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
          // Add markdown files as pages
          pagePaths.push(fullPath);
        } else if (entry.kind === 'directory') {
          // Skip .images directory
          if (entry.name === '.images') continue;
          // Recursively scan subdirectories
          await scanDir(fullPath);
        }
      }
    };

    await scanDir(path);
    return pagePaths;
  }

  /**
   * Generate a unique file name if the target already exists
   * e.g., "Page.md" → "Page 2.md" → "Page 3.md"
   * @param basePath - Directory path (e.g., "workspace")
   * @param fileName - Desired file name (e.g., "My Page.md")
   */
  async getUniqueFileName(basePath: string, fileName: string): Promise<string> {
    const nameWithoutExt = fileName.replace(/\.md$/, '');
    let counter = 1;
    let candidateName = fileName;

    while (await this.exists(`${basePath}/${candidateName}`)) {
      counter++;
      candidateName = `${nameWithoutExt} ${counter}.md`;
    }

    return candidateName;
  }
}
