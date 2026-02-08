/**
 * Type declarations for the File System Access API
 * These APIs are available in Chrome/Edge but not in standard TypeScript DOM lib.
 */

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemHandle {
  readonly kind: 'file' | 'directory';
  readonly name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: 'file';
  getFile(): Promise<File>;
  createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: string | BufferSource | Blob): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  readonly kind: 'directory';
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
  values(): AsyncIterableIterator<FileSystemHandle>;
  keys(): AsyncIterableIterator<string>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

interface ShowDirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | FileSystemHandle;
}

interface Window {
  showDirectoryPicker(options?: ShowDirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
}

declare function showDirectoryPicker(options?: ShowDirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
