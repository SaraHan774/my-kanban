/**
 * SAF (Storage Access Framework) File System Service
 * Uses Android's DocumentFile API via the AndroidSaf JS bridge
 * to access Google Drive and other document providers.
 */

import { IFileSystemService } from '@/types';

declare global {
  interface Window {
    AndroidSaf?: {
      pickDirectory(): string;
      readTextFile(treeUri: string, path: string): string;
      writeTextFile(treeUri: string, path: string, content: string): boolean;
      readBinaryFile(treeUri: string, path: string): string;
      writeBinaryFile(treeUri: string, path: string, base64Data: string): boolean;
      listDirectory(treeUri: string, path: string): string;
      exists(treeUri: string, path: string): boolean;
      createDirectory(treeUri: string, path: string): boolean;
      delete(treeUri: string, path: string): boolean;
    };
  }
}

const LS_SAF_URI = 'saf-tree-uri';

export function isSafAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.AndroidSaf;
}

export function hasSavedSafUri(): boolean {
  return !!localStorage.getItem(LS_SAF_URI);
}

export class SafFileSystemService implements IFileSystemService {
  private treeUri: string | null = null;

  constructor() {
    this.treeUri = localStorage.getItem(LS_SAF_URI);
  }

  private get saf() {
    if (!window.AndroidSaf) {
      throw new Error('AndroidSaf bridge not available');
    }
    return window.AndroidSaf;
  }

  private requireUri(): string {
    if (!this.treeUri) {
      throw new Error('No SAF directory selected');
    }
    return this.treeUri;
  }

  async requestDirectoryAccess(): Promise<string> {
    const uri = this.saf.pickDirectory();
    if (!uri) {
      throw new Error('No directory selected');
    }
    this.treeUri = uri;
    localStorage.setItem(LS_SAF_URI, uri);

    // Ensure workspace subdirectory exists
    try {
      this.saf.createDirectory(uri, 'workspace');
    } catch {
      // May already exist
    }

    return uri;
  }

  async requestDirectoryWithPicker(): Promise<string | null> {
    try {
      const uri = this.saf.pickDirectory();
      if (uri) {
        this.treeUri = uri;
        localStorage.setItem(LS_SAF_URI, uri);
        try {
          this.saf.createDirectory(uri, 'workspace');
        } catch { /* ignore */ }
        return uri;
      }
    } catch { /* ignore */ }
    return null;
  }

  async tryRestore(): Promise<'granted' | 'prompt' | 'denied'> {
    const saved = localStorage.getItem(LS_SAF_URI);
    if (!saved) return 'denied';
    this.treeUri = saved;
    return 'granted';
  }

  async requestRestoredPermission(): Promise<boolean> {
    const saved = localStorage.getItem(LS_SAF_URI);
    if (!saved) return false;
    this.treeUri = saved;
    return true;
  }

  getRootHandle(): string | null {
    return this.treeUri;
  }

  setRootHandle(uri: string): void {
    this.treeUri = uri;
    localStorage.setItem(LS_SAF_URI, uri);
  }

  async readFile(path: string): Promise<string> {
    const content = this.saf.readTextFile(this.requireUri(), path);
    if (content === '' && !this.saf.exists(this.requireUri(), path)) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const ok = this.saf.writeTextFile(this.requireUri(), path, content);
    if (!ok) {
      throw new Error(`Failed to write: ${path}`);
    }
  }

  async createDirectory(path: string): Promise<void> {
    this.saf.createDirectory(this.requireUri(), path);
  }

  async listDirectory(
    path: string = ''
  ): Promise<Array<{ name: string; kind: 'file' | 'directory' }>> {
    const json = this.saf.listDirectory(this.requireUri(), path);
    const entries = JSON.parse(json) as Array<{ name: string; kind: string }>;
    return entries.map((e) => ({
      name: e.name,
      kind: e.kind as 'file' | 'directory',
    }));
  }

  async delete(path: string): Promise<void> {
    this.saf.delete(this.requireUri(), path);
  }

  async exists(path: string): Promise<boolean> {
    return this.saf.exists(this.requireUri(), path);
  }

  async writeBinaryFile(path: string, data: Uint8Array): Promise<void> {
    // Convert Uint8Array to base64
    let binary = '';
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    const base64 = btoa(binary);
    const ok = this.saf.writeBinaryFile(this.requireUri(), path, base64);
    if (!ok) {
      throw new Error(`Failed to write binary: ${path}`);
    }
  }

  async readBinaryFile(path: string): Promise<Uint8Array> {
    const base64 = this.saf.readBinaryFile(this.requireUri(), path);
    if (!base64) {
      throw new Error(`File not found: ${path}`);
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async scanPages(path: string = 'workspace'): Promise<string[]> {
    const pagePaths: string[] = [];

    const scanDir = async (dirPath: string): Promise<void> => {
      const entries = await this.listDirectory(dirPath);
      for (const entry of entries) {
        const fullPath = dirPath ? `${dirPath}/${entry.name}` : entry.name;
        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
          pagePaths.push(fullPath);
        } else if (entry.kind === 'directory') {
          if (entry.name === '.images') continue;
          await scanDir(fullPath);
        }
      }
    };

    await scanDir(path);
    return pagePaths;
  }

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
