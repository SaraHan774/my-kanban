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
 * Convert wiki links to HTML with proper classes
 * This allows us to style page links differently from regular markdown links
 */
export function convertWikiLinksToMarkdown(content: string, pages: Page[]): string {
  const links = parseWikiLinks(content);

  // Process links in reverse order to maintain correct indices
  let result = content;
  for (let i = links.length - 1; i >= 0; i--) {
    const link = links[i];

    // Check if it's an ID-based link (format: [[page-id|Display Text]])
    const pipeIndex = link.target.indexOf('|');
    let targetId = link.target;
    let displayText = link.target;

    if (pipeIndex !== -1) {
      // ID-based link with custom display text
      targetId = link.target.substring(0, pipeIndex).trim();
      displayText = link.target.substring(pipeIndex + 1).trim();
    }

    const page = findPageByIdOrTitle(targetId, pages);

    if (page) {
      // Convert to HTML link with page-link class to distinguish from regular links
      const htmlLink = `<a href="/page/${page.id}" class="page-link">${displayText || page.title}</a>`;
      result = result.substring(0, link.startIndex) + htmlLink + result.substring(link.endIndex);
    } else {
      // Page not found - mark as broken
      const brokenLink = `<span class="wiki-link-broken">[[${link.target}]]</span>`;
      result = result.substring(0, link.startIndex) + brokenLink + result.substring(link.endIndex);
    }
  }

  return result;
}
