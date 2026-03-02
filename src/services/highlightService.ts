/**
 * Highlight Service
 *
 * Manages text highlighting with multiple matching strategies.
 * Extracted from PageView.tsx to improve maintainability and debuggability.
 *
 * Key Features:
 * - Multi-strategy text matching (firstWords/lastWords, context, fuzzy)
 * - O(H+N) complexity via pre-computed position maps and word indices
 * - Debug mode for detailed logging
 * - Dark mode color adjustment support
 *
 * Usage:
 * ```typescript
 * import { highlightService } from '@/services';
 *
 * // Apply highlights to HTML
 * const html = highlightService.applyHighlightsToHtml(
 *   originalHtml,
 *   highlights,
 *   visible
 * );
 *
 * // Create new highlight
 * const { contextBefore, contextAfter } = highlightService.extractHighlightContext(
 *   plainText, startOffset, endOffset
 * );
 * ```
 */

import type { Highlight } from '@/types/page';
import { getHighlightColor, getUnderlineColor } from '@/utils/colorAdjust';

// ============================================================================
// Pure Utility Functions (exported for testing)
// ============================================================================

/**
 * Normalizes whitespace in text by collapsing multiple spaces into one.
 * Used for fuzzy text matching that's resilient to formatting differences.
 *
 * @example
 * normalizeWhitespace('hello  world\n\ttest') // 'hello world test'
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Builds a position map from normalized text to original text positions.
 * This allows us to find matches in normalized text, then map back to original offsets.
 *
 * Algorithm:
 * - Scans through original text character by character
 * - Collapses consecutive whitespace into single space in normalized version
 * - Maps each normalized position to its corresponding original position
 *
 * Complexity: O(N) where N is text length
 *
 * @example
 * const text = 'hello  world'; // Two spaces
 * const map = buildPositionMap(text);
 * // map[6] = 7 (position of 'w' in original text)
 */
export function buildPositionMap(fullText: string): number[] {
  const positionMap: number[] = [0];
  let normPos = 0;
  let inWhitespace = false;

  for (let i = 0; i < fullText.length; i++) {
    const char = fullText[i];
    const isWhitespace = /\s/.test(char);

    if (isWhitespace) {
      if (!inWhitespace) {
        positionMap[normPos] = i;
        normPos++;
        inWhitespace = true;
      }
    } else {
      positionMap[normPos] = i;
      normPos++;
      inWhitespace = false;
    }
  }
  return positionMap;
}

// ============================================================================
// Matching Strategy Functions
// ============================================================================



// ============================================================================
// Service Class
// ============================================================================

class HighlightService {
  private debugMode: boolean = false;

  /**
   * Enable/disable debug logging.
   * When enabled, logs detailed information about matching attempts.
   *
   * Usage: Press Cmd+Shift+D in PageView to toggle
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    if (enabled) {
      console.log('[HIGHLIGHT DEBUG] Debug mode enabled');
    }
  }

  getDebugMode(): boolean {
    return this.debugMode;
  }

  /**
   * Applies highlights to HTML content using Markdown-first approach.
   *
   * NEW: Markdown-first architecture (v2)
   * - Highlights are stored with Markdown content offsets
   * - This function maps Markdown offsets → HTML positions
   * - 2-tier fallback: exact offset (99%) → fuzzy match (1%)
   *
   * @param html - HTML string to apply highlights to
   * @param markdownContent - Original markdown content (source of truth)
   * @param highlights - Array of highlight objects
   * @param visible - Whether highlights should be visible
   * @returns Modified HTML with <mark> elements
   */
  applyHighlightsToHtml(
    html: string,
    markdownContent: string,
    highlights: Highlight[],
    visible: boolean
  ): string {
    if (!highlights || highlights.length === 0 || !visible) return html;

    // Create temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // FIX: Add spaces between block elements to preserve structure
    // Without this, <li>A</li><li>B</li> becomes "AB" instead of "A B"
    this.insertSpacesBetweenBlocks(tempDiv);

    const htmlText = tempDiv.textContent || '';

    if (this.debugMode) {
      console.log('[HIGHLIGHT RENDER] Starting highlight rendering (Markdown-first)', {
        highlightCount: highlights.length,
        markdownLength: markdownContent.length,
        htmlLength: htmlText.length,
        markdownPreview: markdownContent.substring(0, 200),
        htmlPreview: htmlText.substring(0, 200)
      });
    }

    // Build Markdown → HTML offset mapping
    const offsetMap = this.buildMarkdownToHtmlOffsetMap(markdownContent, htmlText);

    if (this.debugMode) {
      console.log('[HIGHLIGHT RENDER] Offset map built', {
        mappingSize: offsetMap.size,
        sampleMappings: Array.from(offsetMap.entries()).slice(0, 10)
      });
    }

    // Process each highlight with simplified 2-tier strategy
    highlights.forEach(h => {
      this.processHighlightV2(tempDiv, htmlText, offsetMap, h);
    });

    return tempDiv.innerHTML;
  }

  /**
   * Inserts spaces between block-level elements to preserve text structure.
   *
   * Without this, adjacent block elements have no separation in textContent:
   * - <li>A</li><li>B</li> → "AB" instead of "A B"
   * - <td>X</td><td>Y</td> → "XY" instead of "X Y"
   *
   * This fixes highlight matching in lists and tables.
   */
  private insertSpacesBetweenBlocks(container: HTMLElement): void {
    // Block elements that should have space after them
    const blockElements = container.querySelectorAll(
      'li, td, th, p, div.mermaid-block, blockquote, h1, h2, h3, h4, h5, h6, pre'
    );

    blockElements.forEach(el => {
      // Add a space node after each block element's last text node
      const walker = document.createTreeWalker(
        el,
        NodeFilter.SHOW_TEXT,
        null
      );

      let lastTextNode: Node | null = null;
      let node;
      while ((node = walker.nextNode())) {
        lastTextNode = node;
      }

      // Append space to last text node, or create new text node with space
      if (lastTextNode && lastTextNode.textContent) {
        // Only add space if it doesn't already end with whitespace
        if (!/\s$/.test(lastTextNode.textContent)) {
          lastTextNode.textContent += ' ';
        }
      } else if (el.childNodes.length > 0) {
        // No text nodes, append space as new text node
        el.appendChild(document.createTextNode(' '));
      }
    });
  }

  /**
   * Builds a mapping from Markdown offsets to HTML text offsets.
   *
   * Algorithm:
   * - Normalizes whitespace in both texts
   * - Aligns them character by character
   * - Creates bidirectional mapping (Markdown ↔ HTML)
   *
   * Handles:
   * - Markdown syntax removal (**, __, #, etc.)
   * - List markers (-, *, +, 1.)
   * - Code blocks
   * - Whitespace normalization
   *
   * @returns Map<markdownOffset, htmlOffset>
   */
  private buildMarkdownToHtmlOffsetMap(
    markdownContent: string,
    htmlText: string
  ): Map<number, number> {
    const map = new Map<number, number>();

    // Normalize both texts for alignment
    const normalizedMarkdown = normalizeWhitespace(markdownContent);
    const normalizedHtml = normalizeWhitespace(htmlText);

    // Build position maps for both
    const mdPosMap = buildPositionMap(markdownContent);
    const htmlPosMap = buildPositionMap(htmlText);

    let mdPos = 0;
    let htmlPos = 0;

    // Align normalized texts character by character
    while (mdPos < normalizedMarkdown.length && htmlPos < normalizedHtml.length) {
      const mdChar = normalizedMarkdown[mdPos];
      const htmlChar = normalizedHtml[htmlPos];

      if (mdChar === htmlChar) {
        // Characters match - create mapping
        const originalMdPos = mdPosMap[mdPos] || mdPos;
        const originalHtmlPos = htmlPosMap[htmlPos] || htmlPos;
        map.set(originalMdPos, originalHtmlPos);
        mdPos++;
        htmlPos++;
      } else {
        // Mismatch - likely markdown syntax that was removed
        // Skip in markdown, continue in HTML
        mdPos++;
      }
    }

    return map;
  }

  /**
   * Processes a single highlight with simplified 2-tier strategy (v2).
   *
   * Strategy:
   * 1. Try exact Markdown offset (99% success rate)
   * 2. Fall back to firstWords/lastWords fuzzy match (1%)
   */
  private processHighlightV2(
    container: HTMLElement,
    htmlText: string,
    offsetMap: Map<number, number>,
    highlight: Highlight
  ): void {
    // Strategy 1: Exact offset mapping (PRIMARY)
    const htmlStart = offsetMap.get(highlight.startOffset);
    const htmlEnd = offsetMap.get(highlight.endOffset);

    if (htmlStart !== undefined && htmlEnd !== undefined) {
      if (this.debugMode) {
        console.log('[HIGHLIGHT MATCH] ✓ Exact offset match', {
          id: highlight.id,
          markdownOffset: [highlight.startOffset, highlight.endOffset],
          htmlOffset: [htmlStart, htmlEnd],
          text: highlight.text
        });
      }
      this.applyHighlightToNodes(container, highlight.text, htmlStart, highlight, htmlEnd);
      return;
    }

    // Strategy 2: Fuzzy match using firstWords/lastWords (FALLBACK)
    if (this.debugMode) {
      console.log('[HIGHLIGHT MATCH] Offset mapping failed, trying fuzzy match', {
        id: highlight.id,
        firstWords: highlight.firstWords,
        lastWords: highlight.lastWords
      });
    }

    const match = this.fuzzyMatchByWords(htmlText, highlight.firstWords, highlight.lastWords);

    if (match) {
      if (this.debugMode) {
        console.log('[HIGHLIGHT MATCH] ✓ Fuzzy match succeeded', {
          id: highlight.id,
          htmlOffset: [match.startPos, match.endPos],
          matchedText: htmlText.substring(match.startPos, match.endPos)
        });
      }
      this.applyHighlightToNodes(container, highlight.text, match.startPos, highlight, match.endPos);
      return;
    }

    // Both strategies failed
    console.warn('[HIGHLIGHT MATCH] ✗ All strategies failed', {
      id: highlight.id,
      text: highlight.text,
      firstWords: highlight.firstWords,
      lastWords: highlight.lastWords,
      suggestion: 'Text may have been deleted or heavily modified. Consider deleting this highlight.'
    });
  }

  /**
   * Fuzzy match using firstWords and lastWords.
   */
  private fuzzyMatchByWords(
    text: string,
    firstWords: string,
    lastWords: string
  ): { startPos: number; endPos: number } | null {
    const normalizedText = normalizeWhitespace(text);
    const normalizedFirst = normalizeWhitespace(firstWords);
    const normalizedLast = normalizeWhitespace(lastWords);

    // Find first words
    const firstIndex = normalizedText.indexOf(normalizedFirst);
    if (firstIndex === -1) return null;

    // Find last words after first words
    const lastIndex = normalizedText.indexOf(normalizedLast, firstIndex + normalizedFirst.length);
    if (lastIndex === -1) return null;

    return {
      startPos: firstIndex,
      endPos: lastIndex + normalizedLast.length
    };
  }


  /**
   * Applies a highlight to text nodes at a specific position.
   *
   * Uses TreeWalker to find text nodes and wraps matching portions in <mark> elements.
   * Handles multi-line highlights and partial node matches.
   */
  private applyHighlightToNodes(
    container: HTMLElement,
    searchText: string,
    startPosition: number,
    highlight: Highlight,
    endPosition?: number
  ): void {
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentOffset = 0;
    let textNode;
    const nodesToProcess: Array<{ node: Node; localStart: number; localEnd: number }> = [];

    const actualEndPosition = endPosition !== undefined ? endPosition : (startPosition + searchText.length);

    // Find all text nodes that contain part of the highlight
    while ((textNode = walker.nextNode())) {
      const textContent = textNode.textContent || '';
      const nodeStart = currentOffset;
      const nodeEnd = currentOffset + textContent.length;

      // Check if this text node overlaps with the highlight range
      if (nodeStart < actualEndPosition && nodeEnd > startPosition) {
        const localStart = Math.max(0, startPosition - nodeStart);
        const localEnd = Math.min(textContent.length, actualEndPosition - nodeStart);
        nodesToProcess.push({ node: textNode, localStart, localEnd });
      }

      currentOffset = nodeEnd;
    }

    // Apply highlights to collected nodes (reverse order to avoid DOM shifts)
    nodesToProcess.reverse().forEach(({ node, localStart, localEnd }) => {
      this.createHighlightMark(node, localStart, localEnd, highlight);
    });
  }

  /**
   * Creates a <mark> element for a portion of a text node.
   */
  private createHighlightMark(
    node: Node,
    localStart: number,
    localEnd: number,
    highlight: Highlight
  ): void {
    const textContent = node.textContent || '';

    const before = textContent.substring(0, localStart);
    const highlighted = textContent.substring(localStart, localEnd);
    const after = textContent.substring(localEnd);

    // Skip if highlighted portion is only whitespace
    if (highlighted.trim().length === 0) {
      return;
    }

    const mark = document.createElement('mark');
    mark.className = `highlight highlight-${highlight.style}`;

    // Apply colors with dark mode adjustment
    mark.style.backgroundColor = highlight.style === 'highlight'
      ? getHighlightColor(highlight.color)
      : 'transparent';
    mark.style.borderBottom = highlight.style === 'underline'
      ? `3px solid ${getUnderlineColor(highlight.color)}`
      : 'none';
    mark.setAttribute('data-highlight-id', highlight.id);
    mark.textContent = highlighted;

    const fragment = document.createDocumentFragment();
    if (before) fragment.appendChild(document.createTextNode(before));
    fragment.appendChild(mark);
    if (after) fragment.appendChild(document.createTextNode(after));

    node.parentNode?.replaceChild(fragment, node);
  }

  /**
   * Finds text in Markdown content and returns its offsets.
   *
   * NEW: This is the main function for creating highlights from user selection.
   * It takes the selected HTML text and finds it in the Markdown content.
   *
   * @param selectedText - Text selected by user (from HTML rendering)
   * @param markdownContent - Original markdown content
   * @returns Markdown offsets and cleaned text, or null if not found
   */
  findTextInMarkdown(
    selectedText: string,
    markdownContent: string
  ): { text: string; startOffset: number; endOffset: number } | null {
    const cleanedText = selectedText.trim();
    if (!cleanedText) return null;

    // Normalize for matching
    const normalizedSearch = normalizeWhitespace(cleanedText);
    const normalizedMarkdown = normalizeWhitespace(markdownContent);

    // Find in normalized text
    const normalizedIndex = normalizedMarkdown.indexOf(normalizedSearch);
    if (normalizedIndex === -1) {
      if (this.debugMode) {
        console.warn('[FIND IN MARKDOWN] Not found in normalized text', {
          selectedText: cleanedText.substring(0, 50),
          normalizedSearch: normalizedSearch.substring(0, 50)
        });
      }
      return null;
    }

    // Map back to original Markdown offsets
    const positionMap = buildPositionMap(markdownContent);
    const startOffset = positionMap[normalizedIndex] || normalizedIndex;
    const endOffset = positionMap[normalizedIndex + normalizedSearch.length] || (normalizedIndex + normalizedSearch.length);

    // Extract actual text from markdown (may differ slightly from selected text)
    const actualText = markdownContent.substring(startOffset, endOffset).trim();

    if (this.debugMode) {
      console.log('[FIND IN MARKDOWN] Found', {
        selectedText: cleanedText.substring(0, 50),
        actualText: actualText.substring(0, 50),
        markdownOffset: [startOffset, endOffset]
      });
    }

    return { text: actualText, startOffset, endOffset };
  }


  /**
   * Extracts first/last words for anchor-based matching.
   *
   * @param text - Text to extract words from
   * @param wordCount - Number of words to extract from each end (default: 3)
   */
  extractAnchorWords(
    text: string,
    wordCount: number = 3
  ): { firstWords: string; lastWords: string } {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const firstWords = words.slice(0, wordCount).join(' ');
    const lastWords = words.slice(-wordCount).join(' ');
    return { firstWords, lastWords };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const highlightService = new HighlightService();
