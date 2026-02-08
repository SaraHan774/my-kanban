/**
 * File System Service
 * Handles all file I/O operations using the File System Access API
 *
 * This service provides an abstraction layer for reading/writing
 * markdown files with YAML frontmatter to the local file system.
 */

export class FileSystemService {
  private rootHandle: FileSystemDirectoryHandle | null = null;

  /**
   * Request access to a directory from the user
   * This will prompt the user to select a folder
   */
  async requestDirectoryAccess(): Promise<FileSystemDirectoryHandle> {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('File System Access API is not supported in this browser');
    }

    this.rootHandle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents'
    });

    return this.rootHandle;
  }

  /**
   * Get the current root directory handle
   */
  getRootHandle(): FileSystemDirectoryHandle | null {
    return this.rootHandle;
  }

  /**
   * Set the root directory handle (e.g., from saved permission)
   */
  setRootHandle(handle: FileSystemDirectoryHandle): void {
    this.rootHandle = handle;
  }

  /**
   * Read a file from the file system
   * @param path - Relative path from root (e.g., "workspace/Project A/index.md")
   */
  async readFile(path: string): Promise<string> {
    if (!this.rootHandle) {
      throw new Error('No root directory selected');
    }

    const fileHandle = await this.getFileHandle(path);
    const file = await fileHandle.getFile();
    return await file.text();
  }

  /**
   * Write content to a file
   * @param path - Relative path from root
   * @param content - File content
   */
  async writeFile(path: string, content: string): Promise<void> {
    if (!this.rootHandle) {
      throw new Error('No root directory selected');
    }

    const fileHandle = await this.getFileHandle(path, true);
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  /**
   * Create a directory
   * @param path - Relative path from root
   */
  async createDirectory(path: string): Promise<FileSystemDirectoryHandle> {
    if (!this.rootHandle) {
      throw new Error('No root directory selected');
    }

    const pathParts = path.split('/').filter(p => p.length > 0);
    let currentHandle = this.rootHandle;

    for (const part of pathParts) {
      currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
    }

    return currentHandle;
  }

  /**
   * List all entries in a directory
   * @param path - Relative path from root (empty string for root)
   */
  async listDirectory(path: string = ''): Promise<Array<{ name: string; kind: 'file' | 'directory' }>> {
    if (!this.rootHandle) {
      throw new Error('No root directory selected');
    }

    const dirHandle = path === ''
      ? this.rootHandle
      : await this.getDirectoryHandle(path);

    const entries: Array<{ name: string; kind: 'file' | 'directory' }> = [];

    for await (const entry of dirHandle.values()) {
      entries.push({
        name: entry.name,
        kind: entry.kind
      });
    }

    return entries;
  }

  /**
   * Delete a file or directory
   * @param path - Relative path from root
   */
  async delete(path: string): Promise<void> {
    if (!this.rootHandle) {
      throw new Error('No root directory selected');
    }

    const pathParts = path.split('/').filter(p => p.length > 0);
    const fileName = pathParts.pop();

    if (!fileName) {
      throw new Error('Invalid path');
    }

    const parentPath = pathParts.join('/');
    const parentHandle = parentPath === ''
      ? this.rootHandle
      : await this.getDirectoryHandle(parentPath);

    await parentHandle.removeEntry(fileName, { recursive: true });
  }

  /**
   * Check if a file or directory exists
   * @param path - Relative path from root
   */
  async exists(path: string): Promise<boolean> {
    try {
      await this.getFileHandle(path);
      return true;
    } catch {
      try {
        await this.getDirectoryHandle(path);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Get a file handle by path
   * @private
   */
  private async getFileHandle(path: string, create: boolean = false): Promise<FileSystemFileHandle> {
    if (!this.rootHandle) {
      throw new Error('No root directory selected');
    }

    const pathParts = path.split('/').filter(p => p.length > 0);
    const fileName = pathParts.pop();

    if (!fileName) {
      throw new Error('Invalid file path');
    }

    let currentHandle = this.rootHandle;

    // Navigate to parent directory
    for (const part of pathParts) {
      currentHandle = await currentHandle.getDirectoryHandle(part, { create });
    }

    return await currentHandle.getFileHandle(fileName, { create });
  }

  /**
   * Get a directory handle by path
   * @private
   */
  private async getDirectoryHandle(path: string): Promise<FileSystemDirectoryHandle> {
    if (!this.rootHandle) {
      throw new Error('No root directory selected');
    }

    const pathParts = path.split('/').filter(p => p.length > 0);
    let currentHandle = this.rootHandle;

    for (const part of pathParts) {
      currentHandle = await currentHandle.getDirectoryHandle(part);
    }

    return currentHandle;
  }

  /**
   * Recursively scan a directory and return all page paths
   * @param path - Directory path to scan
   */
  async scanPages(path: string = 'workspace'): Promise<string[]> {
    const pagePaths: string[] = [];

    async function scanDir(dirPath: string, service: FileSystemService): Promise<void> {
      const entries = await service.listDirectory(dirPath);

      for (const entry of entries) {
        const fullPath = dirPath ? `${dirPath}/${entry.name}` : entry.name;

        if (entry.kind === 'directory') {
          // Check if this directory has an index.md
          const indexPath = `${fullPath}/index.md`;
          if (await service.exists(indexPath)) {
            pagePaths.push(fullPath);
          }
          // Recursively scan subdirectories
          await scanDir(fullPath, service);
        }
      }
    }

    await scanDir(path, this);
    return pagePaths;
  }
}

// Singleton instance
export const fileSystemService = new FileSystemService();
