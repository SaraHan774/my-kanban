export interface DirEntry {
  name: string;
  kind: 'file' | 'directory';
}

export interface IFileSystemService {
  requestDirectoryAccess(): Promise<unknown>;
  requestDirectoryWithPicker?(): Promise<string | null>;
  tryRestore(): Promise<'granted' | 'prompt' | 'denied'>;
  requestRestoredPermission(): Promise<boolean>;
  getRootHandle(): unknown;
  setRootHandle?(path: unknown): void;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  createDirectory(path: string): Promise<unknown>;
  listDirectory(path?: string): Promise<DirEntry[]>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  scanPages(path?: string): Promise<string[]>;
  writeBinaryFile(path: string, data: Uint8Array): Promise<void>;
  readBinaryFile(path: string): Promise<Uint8Array>;
  getUniqueFileName(basePath: string, fileName: string): Promise<string>;
}
