/**
 * Tauri File System Service
 * Handles all file I/O operations using Tauri's FS and Dialog plugins.
 * This is the Tauri-native counterpart of FileSystemService (browser).
 */

import { open } from '@tauri-apps/plugin-dialog';
import {
  readTextFile,
  writeTextFile,
  mkdir,
  readDir,
  remove,
  exists as fsExists,
} from '@tauri-apps/plugin-fs';
import { IFileSystemService } from '@/types';

const LS_WORKSPACE_PATH = 'tauri-workspace-path';

export class TauriFileSystemService implements IFileSystemService {
  private rootPath: string | null = null;

  /**
   * Request access to a directory from the user via native dialog
   */
  async requestDirectoryAccess(): Promise<string> {
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
   * Attempt to restore file system access from a previously saved path.
   */
  async tryRestore(): Promise<'granted' | 'prompt' | 'denied'> {
    try {
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

  /**
   * Recursively scan a directory and return all page paths
   */
  async scanPages(path: string = 'workspace'): Promise<string[]> {
    const pagePaths: string[] = [];

    const scanDir = async (dirPath: string): Promise<void> => {
      const entries = await this.listDirectory(dirPath);

      for (const entry of entries) {
        const fullPath = dirPath ? `${dirPath}/${entry.name}` : entry.name;

        if (entry.kind === 'directory') {
          const indexPath = `${fullPath}/index.md`;
          if (await this.exists(indexPath)) {
            pagePaths.push(fullPath);
          }
          await scanDir(fullPath);
        }
      }
    };

    await scanDir(path);
    return pagePaths;
  }
}
