/**
 * Migration Service
 * Converts old folder-based structure to new file-based structure
 *
 * OLD: workspace/Page Name/index.md + .images/
 * NEW: workspace/Page Name.md + workspace/.images/
 */

import { fileSystemService } from './fileSystemFactory';
import { markdownService } from './markdown';
import { PageFrontmatter } from '@/types';

export interface MigrationResult {
  success: boolean;
  migratedPages: number;
  migratedImages: number;
  errors: string[];
  warnings: string[];
}

export interface MigrationPlan {
  totalPages: number;
  totalImages: number;
  pages: Array<{
    oldPath: string;
    newPath: string;
    hasImages: boolean;
    imageCount: number;
    isNested: boolean;
    parentPath?: string;
  }>;
}

export class MigrationService {
  /**
   * Analyze the current structure and generate a migration plan
   */
  async analyzeMigration(): Promise<MigrationPlan> {
    const plan: MigrationPlan = {
      totalPages: 0,
      totalImages: 0,
      pages: []
    };

    try {
      // Recursively find all index.md files
      const pagePaths = await this.findOldStructurePages('workspace');

      for (const pagePath of pagePaths) {
        // Check for images
        const imagesDir = `${pagePath}/.images`;
        const hasImages = await fileSystemService.exists(imagesDir);
        let imageCount = 0;

        if (hasImages) {
          const entries = await fileSystemService.listDirectory(imagesDir);
          imageCount = entries.filter(e => e.kind === 'file').length;
        }

        // Determine if this is a nested page
        const pathParts = pagePath.split('/').filter(p => p.length > 0);
        const isNested = pathParts.length > 2; // More than "workspace/PageName"
        const parentPath = isNested ? pathParts.slice(0, -1).join('/') : undefined;

        // Generate new file path
        const pageName = pathParts[pathParts.length - 1];
        const newPath = `${pathParts.slice(0, -1).join('/')}/${pageName}.md`;

        plan.pages.push({
          oldPath: pagePath,
          newPath,
          hasImages,
          imageCount,
          isNested,
          parentPath
        });

        plan.totalPages++;
        plan.totalImages += imageCount;
      }
    } catch (error) {
      console.error('Failed to analyze migration:', error);
    }

    return plan;
  }

  /**
   * Execute the migration
   * IMPORTANT: Creates a backup before migrating
   */
  async migrate(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      migratedPages: 0,
      migratedImages: 0,
      errors: [],
      warnings: []
    };

    try {
      // Step 1: Analyze migration
      const plan = await this.analyzeMigration();

      if (plan.totalPages === 0) {
        result.warnings.push('No pages found to migrate');
        result.success = true;
        return result;
      }

      // Step 2: Create centralized .images directory
      const centralImagesDir = 'workspace/.images';
      if (!(await fileSystemService.exists(centralImagesDir))) {
        await fileSystemService.createDirectory(centralImagesDir);
      }

      // Step 3: Build parent ID map for nested pages
      const parentIdMap = await this.buildParentIdMap(plan);

      // Step 4: Migrate each page
      for (const pageInfo of plan.pages) {
        try {
          await this.migratePage(pageInfo, parentIdMap, centralImagesDir);
          result.migratedPages++;

          if (pageInfo.hasImages) {
            result.migratedImages += pageInfo.imageCount;
          }
        } catch (error) {
          const errorMsg = `Failed to migrate ${pageInfo.oldPath}: ${error}`;
          result.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // Step 5: Clean up empty directories
      await this.cleanupEmptyDirectories(plan);

      result.success = result.errors.length === 0;
    } catch (error) {
      result.errors.push(`Migration failed: ${error}`);
      result.success = false;
    }

    return result;
  }

  /**
   * Find all pages in old structure (directories with index.md)
   */
  private async findOldStructurePages(basePath: string): Promise<string[]> {
    const pagePaths: string[] = [];

    const scanDir = async (dirPath: string): Promise<void> => {
      const entries = await fileSystemService.listDirectory(dirPath);

      for (const entry of entries) {
        if (entry.kind === 'directory') {
          const fullPath = `${dirPath}/${entry.name}`;

          // Skip .images directories
          if (entry.name === '.images') continue;

          // Check if this directory has index.md
          const indexPath = `${fullPath}/index.md`;
          if (await fileSystemService.exists(indexPath)) {
            pagePaths.push(fullPath);
          }

          // Recursively scan subdirectories
          await scanDir(fullPath);
        }
      }
    };

    await scanDir(basePath);
    return pagePaths;
  }

  /**
   * Build a map of parent IDs for nested pages
   */
  private async buildParentIdMap(plan: MigrationPlan): Promise<Map<string, string>> {
    const map = new Map<string, string>();

    for (const pageInfo of plan.pages) {
      const indexPath = `${pageInfo.oldPath}/index.md`;
      const content = await fileSystemService.readFile(indexPath);
      const { frontmatter } = markdownService.parse(content, indexPath);

      // Store path -> id mapping
      map.set(pageInfo.oldPath, frontmatter.id);
    }

    return map;
  }

  /**
   * Migrate a single page
   */
  private async migratePage(
    pageInfo: { oldPath: string; newPath: string; hasImages: boolean; isNested: boolean; parentPath?: string },
    parentIdMap: Map<string, string>,
    centralImagesDir: string
  ): Promise<void> {
    // Read the index.md file
    const indexPath = `${pageInfo.oldPath}/index.md`;
    const content = await fileSystemService.readFile(indexPath);
    const { frontmatter, content: markdownContent } = markdownService.parse(content, indexPath);

    // Set parentId if this is a nested page
    let updatedFrontmatter: PageFrontmatter = { ...frontmatter };

    if (pageInfo.isNested && pageInfo.parentPath) {
      const parentId = parentIdMap.get(pageInfo.parentPath);
      if (parentId) {
        updatedFrontmatter = { ...frontmatter, parentId };
      }
    }

    // Update image paths in markdown content
    let updatedContent = markdownContent;
    if (pageInfo.hasImages) {
      // Replace .images/ with workspace/.images/ or just .images/ (will work from workspace root)
      updatedContent = markdownContent.replace(/!\[([^\]]*)\]\(\.images\/([^)]+)\)/g, '![$1](.images/$2)');
    }

    // Write to new file location
    const newMarkdown = markdownService.serialize(updatedFrontmatter, updatedContent);
    await fileSystemService.writeFile(pageInfo.newPath, newMarkdown);

    // Migrate images to central directory
    if (pageInfo.hasImages) {
      const oldImagesDir = `${pageInfo.oldPath}/.images`;
      const entries = await fileSystemService.listDirectory(oldImagesDir);

      for (const entry of entries) {
        if (entry.kind === 'file') {
          const oldImagePath = `${oldImagesDir}/${entry.name}`;
          const newImagePath = `${centralImagesDir}/${entry.name}`;

          // Only copy if not already exists (in case of duplicates)
          if (!(await fileSystemService.exists(newImagePath))) {
            const imageData = await fileSystemService.readBinaryFile(oldImagePath);
            await fileSystemService.writeBinaryFile(newImagePath, imageData);
          }
        }
      }
    }

    // Delete the old directory
    await fileSystemService.delete(pageInfo.oldPath);
  }

  /**
   * Clean up empty directories after migration
   */
  private async cleanupEmptyDirectories(plan: MigrationPlan): Promise<void> {
    // Get all unique parent directories that might be empty
    const dirsToCheck = new Set<string>();

    for (const pageInfo of plan.pages) {
      const parts = pageInfo.oldPath.split('/');
      for (let i = 2; i < parts.length; i++) {
        const dir = parts.slice(0, i).join('/');
        dirsToCheck.add(dir);
      }
    }

    // Check each directory and delete if empty
    for (const dir of Array.from(dirsToCheck).sort().reverse()) {
      try {
        if (await fileSystemService.exists(dir)) {
          const entries = await fileSystemService.listDirectory(dir);
          if (entries.length === 0) {
            await fileSystemService.delete(dir);
          }
        }
      } catch (error) {
        console.warn(`Failed to clean up directory ${dir}:`, error);
      }
    }
  }

  /**
   * Check if migration is needed
   */
  async needsMigration(): Promise<boolean> {
    try {
      const plan = await this.analyzeMigration();
      return plan.totalPages > 0;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const migrationService = new MigrationService();
