/**
 * File System Service
 * Handles all file I/O operations using the File System Access API
 *
 * This service provides an abstraction layer for reading/writing
 * markdown files with YAML frontmatter to the local file system.
 */

import { IFileSystemService } from '@/types';

// Augment DOM types with File System Access API members not yet in TypeScript's lib
interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

declare global {
  interface FileSystemHandle {
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  }

  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>;
    keys(): AsyncIterableIterator<string>;
    entries(): AsyncIterableIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>;
  }

  interface ShowDirectoryPickerOptions {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | FileSystemHandle;
  }

  function showDirectoryPicker(options?: ShowDirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
}

export class FileSystemService implements IFileSystemService {
  private rootHandle: FileSystemDirectoryHandle | null = null;
  private static readonly DB_NAME = 'my-kanban-fs';
  private static readonly STORE_NAME = 'handles';

  /**
   * Request access to a directory from the user
   * This will prompt the user to select a folder
   */
  async requestDirectoryAccess(): Promise<FileSystemDirectoryHandle> {
    if (typeof showDirectoryPicker === 'undefined') {
      throw new Error('File System Access API is not supported in this browser');
    }

    const handle = await showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents'
    });

    this.rootHandle = handle;

    // Persist handle to IndexedDB so it survives page refresh
    try {
      await this.saveHandleToIDB(handle);
    } catch {
      // IndexedDB unavailable (e.g. in tests) — continue without persistence
    }

    return handle;
  }

  /**
   * Attempt to restore file system access from a previously saved handle.
   * Returns 'granted' if restored silently, 'prompt' if user gesture needed,
   * or 'denied' if no saved handle exists.
   */
  async tryRestore(): Promise<'granted' | 'prompt' | 'denied'> {
    try {
      const handle = await this.loadHandleFromIDB();
      if (!handle) return 'denied';

      const permission = await handle.queryPermission({ mode: 'readwrite' });

      if (permission === 'granted') {
        this.rootHandle = handle;
        return 'granted';
      }

      // Handle exists in IDB but needs user gesture to re-grant permission
      if (permission === 'prompt') {
        return 'prompt';
      }

      return 'denied';
    } catch {
      return 'denied';
    }
  }

  /**
   * Re-request permission for a previously saved handle (requires user gesture / click)
   */
  async requestRestoredPermission(): Promise<boolean> {
    try {
      const handle = await this.loadHandleFromIDB();
      if (!handle) return false;

      const permission = await handle.requestPermission({ mode: 'readwrite' });
      if (permission === 'granted') {
        this.rootHandle = handle;
        return true;
      }
      return false;
    } catch {
      return false;
    }
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

  // --- IndexedDB persistence for FileSystemDirectoryHandle ---

  private async saveHandleToIDB(handle: FileSystemDirectoryHandle): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(FileSystemService.DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(FileSystemService.STORE_NAME);
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(FileSystemService.STORE_NAME, 'readwrite');
        tx.objectStore(FileSystemService.STORE_NAME).put(handle, 'root');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async loadHandleFromIDB(): Promise<FileSystemDirectoryHandle | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(FileSystemService.DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(FileSystemService.STORE_NAME);
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(FileSystemService.STORE_NAME, 'readonly');
        const getReq = tx.objectStore(FileSystemService.STORE_NAME).get('root');
        getReq.onsuccess = () => { db.close(); resolve(getReq.result || null); };
        getReq.onerror = () => { db.close(); reject(getReq.error); };
      };
      request.onerror = () => reject(request.error);
    });
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

  async writeBinaryFile(path: string, data: Uint8Array): Promise<void> {
    if (!this.rootHandle) {
      throw new Error('No root directory selected');
    }
    const fileHandle = await this.getFileHandle(path, true);
    const writable = await fileHandle.createWritable();
    await writable.write(data.buffer as ArrayBuffer);
    await writable.close();
  }

  async readBinaryFile(path: string): Promise<Uint8Array> {
    if (!this.rootHandle) {
      throw new Error('No root directory selected');
    }
    const fileHandle = await this.getFileHandle(path);
    const file = await fileHandle.getFile();
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  }

  /**
   * Recursively scan a directory and return all page paths
   * NEW: Scans for .md files instead of directories with index.md
   * @param path - Directory path to scan
   */
  async scanPages(path: string = 'workspace'): Promise<string[]> {
    const pagePaths: string[] = [];

    async function scanDir(dirPath: string, service: FileSystemService): Promise<void> {
      const entries = await service.listDirectory(dirPath);

      for (const entry of entries) {
        const fullPath = dirPath ? `${dirPath}/${entry.name}` : entry.name;

        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
          // Add markdown files as pages
          pagePaths.push(fullPath);
        } else if (entry.kind === 'directory') {
          // Skip .images directory
          if (entry.name === '.images') continue;
          // Recursively scan subdirectories
          await scanDir(fullPath, service);
        }
      }
    }

    await scanDir(path, this);
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

// Singleton is now exported from fileSystemFactory.ts
