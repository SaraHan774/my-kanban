/**
 * Image Service
 * NEW: Handles saving images to a centralized workspace/.images/ directory
 * and resolving image paths in rendered HTML using blob URLs with caching.
 *
 * All images are stored in workspace/.images/ regardless of which page they belong to.
 * This simplifies the structure and allows for easy deduplication via content hashing.
 */

import { fileSystemService } from './fileSystemFactory';

const IMAGES_DIR = 'workspace/.images';

// In-memory cache: "workspace/.images/hash.ext" → "blob:..."
const blobUrlCache = new Map<string, string>();

async function hashBytes(data: Uint8Array): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
  }
  // Fallback: FNV-1a hash (for environments without crypto.subtle)
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i];
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0') + data.length.toString(16).padStart(4, '0');
}

function getImageExtension(fileName: string, mimeType?: string): string {
  const fromName = fileName.split('.').pop()?.toLowerCase();
  if (fromName && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(fromName)) {
    return fromName;
  }
  if (mimeType) {
    const match = mimeType.match(/image\/(\w+)/);
    if (match) return match[1] === 'jpeg' ? 'jpg' : match[1];
  }
  return 'png';
}

/**
 * Save an image file to the centralized workspace/.images/ directory.
 * NEW: All images go to workspace/.images/ regardless of page
 * Returns the relative markdown path from workspace root: `.images/{hash}.{ext}`
 */
export async function saveImage(_pagePath: string, file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);
  const hash = await hashBytes(data);
  const ext = getImageExtension(file.name, file.type);
  const imageFileName = `${hash}.${ext}`;
  const imagePath = `${IMAGES_DIR}/${imageFileName}`;

  // Ensure .images directory exists
  if (!(await fileSystemService.exists(IMAGES_DIR))) {
    await fileSystemService.createDirectory(IMAGES_DIR);
  }

  // Only write if file doesn't exist (content-addressed storage = automatic deduplication)
  if (!(await fileSystemService.exists(imagePath))) {
    await fileSystemService.writeBinaryFile(imagePath, data);
  }

  // Return path relative to workspace root
  return `.images/${imageFileName}`;
}

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
};

async function resolveImageUrl(_pagePath: string, relativeImagePath: string): Promise<string> {
  // NEW: All images are in workspace/.images/, so pagePath is ignored
  const cacheKey = relativeImagePath;

  const cached = blobUrlCache.get(cacheKey);
  if (cached) return cached;

  // Resolve from workspace root
  const fullPath = relativeImagePath.startsWith('.images/')
    ? `workspace/${relativeImagePath}`
    : relativeImagePath;

  const data = await fileSystemService.readBinaryFile(fullPath);

  const ext = relativeImagePath.split('.').pop()?.toLowerCase() || 'png';
  const mime = MIME_MAP[ext] || 'image/png';

  const blob = new Blob([data.buffer as ArrayBuffer], { type: mime });
  const blobUrl = URL.createObjectURL(blob);

  blobUrlCache.set(cacheKey, blobUrl);
  return blobUrl;
}

/**
 * Resolve all `.images/` references in an HTML string by replacing
 * src=".images/..." with blob URLs. Leaves data: URLs untouched.
 */
export async function resolveImagesInHtml(html: string, pagePath: string): Promise<string> {
  const imagePattern = /src="(\.images\/[^"]+)"/g;
  const matches: Array<{ full: string; path: string }> = [];

  let match;
  while ((match = imagePattern.exec(html)) !== null) {
    matches.push({ full: match[0], path: match[1] });
  }

  if (matches.length === 0) return html;

  const resolved = await Promise.all(
    matches.map(async (m) => {
      try {
        const blobUrl = await resolveImageUrl(pagePath, m.path);
        return { original: m.full, replacement: `src="${blobUrl}"` };
      } catch {
        return { original: m.full, replacement: m.full };
      }
    })
  );

  let result = html;
  for (const { original, replacement } of resolved) {
    result = result.replace(original, replacement);
  }
  return result;
}

/**
 * Revoke all cached blob URLs and clear the cache.
 * Call on page navigation or component unmount.
 */
export function clearImageCache(): void {
  for (const blobUrl of blobUrlCache.values()) {
    URL.revokeObjectURL(blobUrl);
  }
  blobUrlCache.clear();
}

/**
 * DEPRECATED: No longer needed with centralized image storage.
 * All images are in workspace/.images/, so moving pages doesn't require copying images.
 *
 * Kept for backward compatibility during migration.
 */
export async function copyImagesDir(_sourcePath: string, _destPath: string): Promise<void> {
  // No-op: centralized image storage means no per-page directories to copy
  return;
}

/**
 * Find all image references across all markdown pages
 * Returns a Set of image file names that are currently referenced
 */
async function findReferencedImages(): Promise<Set<string>> {
  const referenced = new Set<string>();

  try {
    const pagePaths = await fileSystemService.scanPages('workspace');

    for (const pagePath of pagePaths) {
      const content = await fileSystemService.readFile(pagePath);

      // Find all markdown image references: ![alt](.images/hash.ext)
      const imageRegex = /!\[.*?\]\(\.images\/([^)]+)\)/g;
      let match;

      while ((match = imageRegex.exec(content)) !== null) {
        referenced.add(match[1]);
      }
    }
  } catch (error) {
    console.error('Error scanning for referenced images:', error);
  }

  return referenced;
}

/**
 * Clean up orphaned images (images that exist but are not referenced by any page)
 * Returns the number of images deleted
 */
export async function cleanOrphanImages(): Promise<number> {
  try {
    if (!(await fileSystemService.exists(IMAGES_DIR))) {
      return 0;
    }

    const entries = await fileSystemService.listDirectory(IMAGES_DIR);
    const referencedImages = await findReferencedImages();

    let deletedCount = 0;

    for (const entry of entries) {
      if (entry.kind === 'file' && !referencedImages.has(entry.name)) {
        await fileSystemService.delete(`${IMAGES_DIR}/${entry.name}`);
        deletedCount++;

        // Also clear from blob cache
        blobUrlCache.delete(`.images/${entry.name}`);
      }
    }

    return deletedCount;
  } catch (error) {
    console.error('Error cleaning orphan images:', error);
    return 0;
  }
}
