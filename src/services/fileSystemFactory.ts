/**
 * File System Factory
 * Detects the runtime environment and returns the appropriate FS service.
 * - Tauri mobile + SAF URI saved: uses SAF (Android DocumentFile API)
 * - Tauri (desktop/mobile): uses Tauri FS/Dialog plugins
 * - Browser: uses File System Access API
 */

import { IFileSystemService } from '@/types';
import { FileSystemService } from './fileSystem';
import { TauriFileSystemService } from './tauriFileSystem';
import { SafFileSystemService, isSafAvailable, hasSavedSafUri } from './safFileSystem';

const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const isMobilePlatform = (): boolean =>
  /android/i.test(navigator.userAgent) ||
  /iPad|iPhone|iPod/.test(navigator.userAgent);

function createFileSystemService(): IFileSystemService {
  if (isTauri()) {
    // On mobile with SAF available and a saved SAF URI, use SAF service
    if (isMobilePlatform() && isSafAvailable() && hasSavedSafUri()) {
      return new SafFileSystemService();
    }
    return new TauriFileSystemService();
  }
  return new FileSystemService();
}

export const fileSystemService: IFileSystemService = createFileSystemService();

/**
 * Switch to SAF file system service.
 * Call this after user picks a folder via SAF, then reload the page.
 */
export function switchToSafService(): SafFileSystemService {
  return new SafFileSystemService();
}
