import { Page } from '@/types/page';

export interface WikiLink {
  text: string; // The full [[...]] text
  target: string; // The page ID or title inside [[]]
  startIndex: number;
  endIndex: number;
}

/**
 * Parse wiki-style links from markdown content
 * Supports: [[Page Title]] or [[PageID]]
 */
export function parseWikiLinks(content: string): WikiLink[] {
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
  const links: WikiLink[] = [];
  let match;

  while ((match = wikiLinkRegex.exec(content)) !== null) {
    links.push({
      text: match[0],
      target: match[1].trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return links;
}

/**
 * Find a page by ID or title
 */
export function findPageByIdOrTitle(target: string, pages: Page[]): Page | undefined {
  // Try to find by ID first
  let page = pages.find(p => p.id === target);
  if (page) return page;

  // Try to find by exact title match
  page = pages.find(p => p.title.toLowerCase() === target.toLowerCase());
  if (page) return page;

  return undefined;
}

/**
 * Convert wiki links to markdown links
 */
export function convertWikiLinksToMarkdown(content: string, pages: Page[]): string {
  const links = parseWikiLinks(content);

  // Process links in reverse order to maintain correct indices
  let result = content;
  for (let i = links.length - 1; i >= 0; i--) {
    const link = links[i];
    const page = findPageByIdOrTitle(link.target, pages);

    if (page) {
      // Convert to markdown link: [Page Title](/page/pageId)
      const markdownLink = `[${page.title}](/page/${page.id})`;
      result = result.substring(0, link.startIndex) + markdownLink + result.substring(link.endIndex);
    } else {
      // Page not found - keep as plain text or mark as broken
      const brokenLink = `<span class="wiki-link-broken">[[${link.target}]]</span>`;
      result = result.substring(0, link.startIndex) + brokenLink + result.substring(link.endIndex);
    }
  }

  return result;
}
