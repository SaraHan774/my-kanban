/**
 * Page Service
 * High-level service for managing pages (CRUD operations)
 */

import { Page, PageFrontmatter, FilterCriteria, SortOptions } from '@/types';
import { fileSystemService } from './fileSystemFactory';
import { markdownService } from './markdown';

export class PageService {
  /**
   * Load a page from the file system
   * NEW: Path is now directly to .md file (e.g., "workspace/Project A.md")
   * @param path - Page file path (e.g., "workspace/Project A.md")
   */
  async loadPage(path: string): Promise<Page> {
    const content = await fileSystemService.readFile(path);
    const rawData = markdownService.parse(content, path);

    return {
      ...rawData.frontmatter,
      path,
      content: rawData.content
    };
  }

  /**
   * Load a page with its children
   * NEW: Children loaded by parentId instead of file path
   * @param path - Page file path (e.g., "workspace/My Page.md")
   * @param recursive - Whether to load children recursively
   */
  async loadPageWithChildren(path: string, recursive: boolean = false): Promise<Page> {
    const page = await this.loadPage(path);
    page.children = await this.loadChildren(page.id, recursive);
    return page;
  }

  /**
   * Load all children of a page
   * NEW: Children are determined by parentId field, not file system structure
   * @param parentId - Parent page ID
   * @param recursive - Whether to load children recursively
   */
  async loadChildren(parentId: string, recursive: boolean = false): Promise<Page[]> {
    const allPages = await this.getAllPages();
    const children = allPages.filter(page => page.parentId === parentId);

    if (recursive) {
      // Load grandchildren for each child
      for (const child of children) {
        child.children = await this.loadChildren(child.id, true);
      }
    }

    return children;
  }

  /**
   * Create a new page
   * NEW: Creates a single .md file instead of a directory with index.md
   * @param parentPath - Parent directory path (e.g., "workspace")
   * @param title - Page title
   * @param options - Additional page options
   */
  async createPage(
    parentPath: string,
    title: string,
    options: Partial<PageFrontmatter> = {}
  ): Promise<Page> {
    const now = new Date().toISOString();
    const sanitizedFileName = this.sanitizeFileName(title);
    const fileName = `${sanitizedFileName}.md`;

    // Get unique file name to avoid conflicts
    const uniqueFileName = await fileSystemService.getUniqueFileName(parentPath, fileName);
    const pagePath = `${parentPath}/${uniqueFileName}`;

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

    // Create the .md file with empty content
    const content = '';

    const markdown = markdownService.serialize(frontmatter, content);
    await fileSystemService.writeFile(pagePath, markdown);

    return {
      ...frontmatter,
      path: pagePath,
      content
    };
  }

  /**
   * Update a page
   * NEW: Path is directly to .md file, no /index.md suffix needed
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
      ...(page.parentId && { parentId: page.parentId }),
      ...(page.dueDate && { dueDate: page.dueDate }),
      ...(page.kanbanColumn && { kanbanColumn: page.kanbanColumn }),
      ...(page.googleCalendarEventId && { googleCalendarEventId: page.googleCalendarEventId }),
      ...(page.pinned !== undefined && { pinned: page.pinned }),
      ...(page.pinnedAt && { pinnedAt: page.pinnedAt })
    };

    const markdown = markdownService.serialize(frontmatter, page.content);
    await fileSystemService.writeFile(page.path, markdown);
  }

  /**
   * Delete a page
   * @param path - Page path
   */
  async deletePage(path: string): Promise<void> {
    await fileSystemService.delete(path);
  }

  /**
   * Move a page to a different directory
   * NEW: Much simpler - just read, write to new location, and delete old
   * @param sourcePath - Current page file path (e.g., "workspace/Old.md")
   * @param targetParentPath - New parent directory (e.g., "workspace/subfolder")
   */
  async movePage(sourcePath: string, targetParentPath: string): Promise<string> {
    // Load the page content
    const page = await this.loadPage(sourcePath);

    // Extract file name from source path
    const pathParts = sourcePath.split('/');
    const fileName = pathParts[pathParts.length - 1];

    // Get unique file name in target directory
    const uniqueFileName = await fileSystemService.getUniqueFileName(targetParentPath, fileName);
    const newPath = `${targetParentPath}/${uniqueFileName}`;

    // Write to new location
    const frontmatter: PageFrontmatter = {
      id: page.id,
      title: page.title,
      tags: page.tags,
      createdAt: page.createdAt,
      updatedAt: new Date().toISOString(),
      viewType: page.viewType,
      ...(page.parentId && { parentId: page.parentId }),
      ...(page.dueDate && { dueDate: page.dueDate }),
      ...(page.kanbanColumn && { kanbanColumn: page.kanbanColumn }),
      ...(page.googleCalendarEventId && { googleCalendarEventId: page.googleCalendarEventId }),
      ...(page.pinned !== undefined && { pinned: page.pinned }),
      ...(page.pinnedAt && { pinnedAt: page.pinnedAt })
    };

    const markdown = markdownService.serialize(frontmatter, page.content);
    await fileSystemService.writeFile(newPath, markdown);

    // Delete the old file
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
   * Sanitize file name (remove invalid characters)
   * @private
   */
  private sanitizeFileName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

}

// Singleton instance
export const pageService = new PageService();
