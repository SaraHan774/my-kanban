/**
 * File System Factory
 * Detects the runtime environment and returns the appropriate FS service.
 * - Tauri (desktop): uses Tauri FS/Dialog plugins
 * - Browser: uses File System Access API
 */

import { IFileSystemService } from '@/types';
import { FileSystemService } from './fileSystem';
import { TauriFileSystemService } from './tauriFileSystem';

const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const fileSystemService: IFileSystemService =
  isTauri() ? new TauriFileSystemService() : new FileSystemService();
