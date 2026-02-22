/**
 * Link Service
 * Handles parsing and resolving wiki-style page links [[Page Title]] or [[page-id|Display Text]]
 */

import { ParsedLink, PageLink, Backlink, LinkValidation } from '@/types';
import { fileSystemService } from './fileSystemFactory';
import { markdownService } from './markdown';

export class LinkService {
  /**
   * Parse all wiki-style links from markdown content
   * Supports: [[Page Title]] or [[page-id|Display Text]]
   */
  parseLinks(content: string): ParsedLink[] {
    const links: ParsedLink[] = [];
    const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

    let match;
    while ((match = wikiLinkRegex.exec(content)) !== null) {
      const targetRef = match[1].trim();
      const displayText = match[2]?.trim() || targetRef;
      const isIdBased = this.looksLikeId(targetRef);

      links.push({
        originalText: match[0],
        targetRef,
        displayText,
        isIdBased,
        startPos: match.index,
        endPos: match.index + match[0].length
      });
    }

    return links;
  }

  /**
   * Convert wiki-style links to HTML anchor tags
   * [[Page Title]] → <a href="#" data-page-ref="Page Title">Page Title</a>
   * [[page-id|Display]] → <a href="#" data-page-id="page-id">Display</a>
   */
  convertLinksToHtml(content: string): string {
    return content.replace(
      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_match, targetRef, displayText) => {
        const display = displayText?.trim() || targetRef.trim();
        const ref = targetRef.trim();
        const isId = this.looksLikeId(ref);

        if (isId) {
          return `<a href="#" class="page-link" data-page-id="${ref}">${display}</a>`;
        } else {
          return `<a href="#" class="page-link" data-page-ref="${ref}">${display}</a>`;
        }
      }
    );
  }

  /**
   * Resolve a page reference (title or ID) to a page ID
   * Returns null if not found
   */
  async resolvePageRef(ref: string, isIdBased: boolean): Promise<string | null> {
    const pagePaths = await fileSystemService.scanPages('workspace');

    for (const path of pagePaths) {
      const content = await fileSystemService.readFile(path);
      const { frontmatter } = markdownService.parse(content, path);

      if (isIdBased) {
        if (frontmatter.id === ref) {
          return frontmatter.id;
        }
      } else {
        // Title-based lookup (case-insensitive)
        if (frontmatter.title.toLowerCase() === ref.toLowerCase()) {
          return frontmatter.id;
        }
      }
    }

    return null;
  }

  /**
   * Validate a link and resolve its target
   */
  async validateLink(targetRef: string, isIdBased: boolean): Promise<LinkValidation> {
    const resolvedPageId = await this.resolvePageRef(targetRef, isIdBased);

    if (resolvedPageId) {
      return {
        isValid: true,
        resolvedPageId
      };
    }

    return {
      isValid: false,
      error: `Page not found: ${targetRef}`
    };
  }

  /**
   * Get all backlinks for a given page ID
   * (pages that reference this page)
   */
  async getBacklinks(pageId: string): Promise<Backlink[]> {
    const backlinks: Backlink[] = [];
    const pagePaths = await fileSystemService.scanPages('workspace');

    for (const path of pagePaths) {
      const content = await fileSystemService.readFile(path);
      const { frontmatter } = markdownService.parse(content, path);

      // Skip the page itself
      if (frontmatter.id === pageId) continue;

      const links = this.parseLinks(content);

      for (const link of links) {
        const resolved = await this.resolvePageRef(link.targetRef, link.isIdBased);

        if (resolved === pageId) {
          // Extract context around the link
          const context = this.extractContext(content, link.startPos, 100);

          backlinks.push({
            pageId: frontmatter.id,
            pageTitle: frontmatter.title,
            pagePath: path,
            context
          });

          break; // Only add each page once
        }
      }
    }

    return backlinks;
  }

  /**
   * Create a page link from one page to another
   */
  createPageLink(sourcePageId: string, targetPageId: string, displayText: string): PageLink {
    return {
      sourcePageId,
      targetPageId,
      displayText
    };
  }

  /**
   * Check if a string looks like a UUID/ID vs a page title
   */
  private looksLikeId(str: string): boolean {
    // UUID pattern: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidPattern.test(str);
  }

  /**
   * Extract context around a position in text
   */
  private extractContext(text: string, position: number, maxLength: number): string {
    const start = Math.max(0, position - Math.floor(maxLength / 2));
    const end = Math.min(text.length, position + Math.floor(maxLength / 2));

    let context = text.substring(start, end).trim();

    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';

    return context;
  }
}

// Singleton instance
export const linkService = new LinkService();
