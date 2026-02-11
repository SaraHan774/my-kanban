/**
 * Page Service
 * High-level service for managing pages (CRUD operations)
 */

import { Page, PageFrontmatter, FilterCriteria, SortOptions } from '@/types';
import { fileSystemService } from './fileSystemFactory';
import { markdownService } from './markdown';
import { copyImagesDir } from './imageService';

export class PageService {
  /**
   * Load a page from the file system
   * @param path - Page path (e.g., "workspace/Project A")
   */
  async loadPage(path: string): Promise<Page> {
    const indexPath = `${path}/index.md`;
    const content = await fileSystemService.readFile(indexPath);
    const rawData = markdownService.parse(content, path);

    return {
      ...rawData.frontmatter,
      path,
      content: rawData.content
    };
  }

  /**
   * Load a page with its children
   * @param path - Page path
   * @param recursive - Whether to load children recursively
   */
  async loadPageWithChildren(path: string, recursive: boolean = false): Promise<Page> {
    const page = await this.loadPage(path);
    page.children = await this.loadChildren(path, recursive);
    return page;
  }

  /**
   * Load all children of a page
   * @param parentPath - Parent page path
   * @param recursive - Whether to load children recursively
   */
  async loadChildren(parentPath: string, recursive: boolean = false): Promise<Page[]> {
    const entries = await fileSystemService.listDirectory(parentPath);
    const children: Page[] = [];

    for (const entry of entries) {
      if (entry.kind === 'directory') {
        if (entry.name === '.images') continue;
        const childPath = `${parentPath}/${entry.name}`;
        const indexPath = `${childPath}/index.md`;

        if (await fileSystemService.exists(indexPath)) {
          if (recursive) {
            const child = await this.loadPageWithChildren(childPath, true);
            children.push(child);
          } else {
            const child = await this.loadPage(childPath);
            children.push(child);
          }
        }
      }
    }

    return children;
  }

  /**
   * Create a new page
   * @param parentPath - Parent page path (or workspace root)
   * @param title - Page title
   * @param options - Additional page options
   */
  async createPage(
    parentPath: string,
    title: string,
    options: Partial<PageFrontmatter> = {}
  ): Promise<Page> {
    const now = new Date().toISOString();
    const pageFolderName = this.sanitizeFolderName(title);
    const pagePath = `${parentPath}/${pageFolderName}`;

    // Create the page directory
    await fileSystemService.createDirectory(pagePath);

    // Create frontmatter
    const frontmatter: PageFrontmatter = {
      id: crypto.randomUUID(),
      title,
      tags: [],
      createdAt: now,
      updatedAt: now,
      viewType: 'document',
      ...options
    };

    // Create the index.md file with empty content
    const content = '';

    const markdown = markdownService.serialize(frontmatter, content);
    await fileSystemService.writeFile(`${pagePath}/index.md`, markdown);

    return {
      ...frontmatter,
      path: pagePath,
      content
    };
  }

  /**
   * Update a page
   * @param page - Page to update
   */
  async updatePage(page: Page): Promise<void> {
    const frontmatter: PageFrontmatter = {
      id: page.id,
      title: page.title,
      tags: page.tags,
      createdAt: page.createdAt,
      updatedAt: new Date().toISOString(),
      viewType: page.viewType,
      ...(page.dueDate && { dueDate: page.dueDate }),
      ...(page.kanbanColumn && { kanbanColumn: page.kanbanColumn }),
      ...(page.googleCalendarEventId && { googleCalendarEventId: page.googleCalendarEventId }),
      ...(page.pinned !== undefined && { pinned: page.pinned }),
      ...(page.pinnedAt && { pinnedAt: page.pinnedAt })
    };

    const markdown = markdownService.serialize(frontmatter, page.content);
    await fileSystemService.writeFile(`${page.path}/index.md`, markdown);
  }

  /**
   * Delete a page
   * @param path - Page path
   */
  async deletePage(path: string): Promise<void> {
    await fileSystemService.delete(path);
  }

  /**
   * Move a page to a different parent
   * @param sourcePath - Current page path
   * @param targetParentPath - New parent path
   */
  async movePage(sourcePath: string, targetParentPath: string): Promise<string> {
    // Load the page
    const page = await this.loadPageWithChildren(sourcePath, true);

    // Create in new location
    const pathParts = sourcePath.split('/');
    const folderName = pathParts[pathParts.length - 1];
    const newPath = `${targetParentPath}/${folderName}`;

    // Recreate the page structure recursively
    await this.recreatePage(page, newPath);

    // Delete the old location
    await this.deletePage(sourcePath);

    return newPath;
  }

  /**
   * Get all pages in the workspace
   */
  async getAllPages(): Promise<Page[]> {
    const pagePaths = await fileSystemService.scanPages('workspace');
    const pages: Page[] = [];

    for (const path of pagePaths) {
      const page = await this.loadPage(path);
      pages.push(page);
    }

    return pages;
  }

  /**
   * Filter pages based on criteria
   * @param criteria - Filter criteria
   * @param sort - Sort options
   */
  async filterPages(criteria: FilterCriteria, sort?: SortOptions): Promise<Page[]> {
    let pages = await this.getAllPages();

    // Apply filters
    if (criteria.tags && criteria.tags.length > 0) {
      pages = pages.filter(page =>
        criteria.tags!.some(tag => page.tags.some(t => t.toLowerCase() === tag.toLowerCase()))
      );
    }

    if (criteria.searchText) {
      const searchLower = criteria.searchText.toLowerCase();
      pages = pages.filter(page =>
        page.title.toLowerCase().includes(searchLower) ||
        page.content.toLowerCase().includes(searchLower)
      );
    }

    if (criteria.viewType && criteria.viewType.length > 0) {
      pages = pages.filter(page => criteria.viewType!.includes(page.viewType));
    }

    if (criteria.dateRange) {
      const { start, end, field } = criteria.dateRange;
      pages = pages.filter(page => {
        const date = page[field];
        if (!date) return false;

        if (start && date < start) return false;
        if (end && date > end) return false;
        return true;
      });
    }

    // Apply sorting
    if (sort) {
      pages.sort((a, b) => {
        const aVal = a[sort.field] || '';
        const bVal = b[sort.field] || '';

        if (sort.direction === 'asc') {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
      });
    }

    return pages;
  }

  /**
   * Sanitize folder name (remove invalid characters)
   * @private
   */
  private sanitizeFolderName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Recursively recreate a page structure at a new location
   * @private
   */
  private async recreatePage(page: Page, newPath: string): Promise<void> {
    // Create directory
    await fileSystemService.createDirectory(newPath);

    // Write the page
    const frontmatter: PageFrontmatter = {
      id: page.id,
      title: page.title,
      tags: page.tags,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      viewType: page.viewType,
      ...(page.dueDate && { dueDate: page.dueDate }),
      ...(page.kanbanColumn && { kanbanColumn: page.kanbanColumn }),
      ...(page.googleCalendarEventId && { googleCalendarEventId: page.googleCalendarEventId })
    };

    const markdown = markdownService.serialize(frontmatter, page.content);
    await fileSystemService.writeFile(`${newPath}/index.md`, markdown);

    // Copy .images directory if it exists
    await copyImagesDir(page.path, newPath);

    // Recursively recreate children
    if (page.children) {
      for (const child of page.children) {
        const childPathParts = child.path.split('/');
        const childFolderName = childPathParts[childPathParts.length - 1];
        await this.recreatePage(child, `${newPath}/${childFolderName}`);
      }
    }
  }
}

// Singleton instance
export const pageService = new PageService();
