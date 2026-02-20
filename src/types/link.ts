/**
 * Page Link Types
 * Support for inter-page references using [[Page Title]] or [[page-id|Display Text]] syntax
 */

/**
 * Represents a link from one page to another
 */
export interface PageLink {
  /** Source page ID (where the link is located) */
  sourcePageId: string;

  /** Target page ID (where the link points to) */
  targetPageId: string;

  /** Display text for the link */
  displayText: string;

  /** Position in the source page content (character offset) */
  position?: number;
}

/**
 * Parsed link from markdown content
 * Can be either [[Page Title]] or [[page-id|Display Text]]
 */
export interface ParsedLink {
  /** Original markdown syntax (e.g., "[[My Page]]" or "[[abc-123|My Page]]") */
  originalText: string;

  /** Target reference (either page title or page ID) */
  targetRef: string;

  /** Display text (if specified with |, otherwise same as targetRef) */
  displayText: string;

  /** Whether this is an ID-based link (true) or title-based link (false) */
  isIdBased: boolean;

  /** Start position in content */
  startPos: number;

  /** End position in content */
  endPos: number;
}

/**
 * Link type for wikilink syntax
 * Pattern: [[target]] or [[target|display]]
 */
export type WikiLinkSyntax = 'title-based' | 'id-based';

/**
 * Backlink - represents a page that links to the current page
 */
export interface Backlink {
  /** ID of the page that contains the link */
  pageId: string;

  /** Title of the page that contains the link */
  pageTitle: string;

  /** Path to the page file */
  pagePath: string;

  /** Context snippet around the link (for preview) */
  context?: string;
}

/**
 * Link validation result
 */
export interface LinkValidation {
  /** Whether the link target exists */
  isValid: boolean;

  /** The resolved target page ID (if found) */
  resolvedPageId?: string;

  /** Error message if link is broken */
  error?: string;
}
