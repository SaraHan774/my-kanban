/**
 * Image Service
 * Handles saving images to .images/ directories and resolving
 * image paths in rendered HTML using blob URLs with caching.
 */

import { fileSystemService } from './fileSystemFactory';

const IMAGES_DIR = '.images';

// In-memory cache: "pagePath/.images/hash.ext" → "blob:..."
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
 * Save an image file to the page's .images/ directory.
 * Returns the relative markdown path: `.images/{hash}.{ext}`
 */
export async function saveImage(pagePath: string, file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);
  const hash = await hashBytes(data);
  const ext = getImageExtension(file.name, file.type);
  const imageFileName = `${hash}.${ext}`;
  const imagesDir = `${pagePath}/${IMAGES_DIR}`;
  const imagePath = `${imagesDir}/${imageFileName}`;

  if (!(await fileSystemService.exists(imagesDir))) {
    await fileSystemService.createDirectory(imagesDir);
  }

  if (!(await fileSystemService.exists(imagePath))) {
    await fileSystemService.writeBinaryFile(imagePath, data);
  }

  return `${IMAGES_DIR}/${imageFileName}`;
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

async function resolveImageUrl(pagePath: string, relativeImagePath: string): Promise<string> {
  const cacheKey = `${pagePath}/${relativeImagePath}`;

  const cached = blobUrlCache.get(cacheKey);
  if (cached) return cached;

  const fullPath = `${pagePath}/${relativeImagePath}`;
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
 * Copy the .images/ directory from one page path to another.
 * Used during page move/copy operations.
 */
export async function copyImagesDir(sourcePath: string, destPath: string): Promise<void> {
  const sourceImagesDir = `${sourcePath}/${IMAGES_DIR}`;

  if (!(await fileSystemService.exists(sourceImagesDir))) return;

  const destImagesDir = `${destPath}/${IMAGES_DIR}`;
  await fileSystemService.createDirectory(destImagesDir);

  const entries = await fileSystemService.listDirectory(sourceImagesDir);
  for (const entry of entries) {
    if (entry.kind === 'file') {
      const data = await fileSystemService.readBinaryFile(`${sourceImagesDir}/${entry.name}`);
      await fileSystemService.writeBinaryFile(`${destImagesDir}/${entry.name}`, data);
    }
  }
}
