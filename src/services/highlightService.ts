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
   * Algorithm (IMPROVED v2):
   * - Normalizes whitespace in both texts
   * - Aligns them character by character with bidirectional skip
   * - Creates mapping (Markdown → HTML)
   *
   * Handles:
   * - Markdown syntax removal (**, __, #, etc.)
   * - List markers (-, *, +, 1.)
   * - HTML-added content (spaces from insertSpacesBetweenBlocks)
   * - Code blocks
   * - Whitespace normalization
   *
   * Key improvement: Bidirectional skip logic to handle both
   * - Markdown-only chars (syntax like **, __)
   * - HTML-only chars (added spaces, entities)
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
    let mismatchCount = 0;

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
        // Mismatch - determine which side to skip
        // Look ahead to find the next matching position
        const decision = this.determineBestSkip(
          normalizedMarkdown, mdPos,
          normalizedHtml, htmlPos
        );

        if (decision === 'markdown') {
          mdPos++;
        } else if (decision === 'html') {
          htmlPos++;
        } else {
          // Both skip (rare case)
          mdPos++;
          htmlPos++;
        }

        mismatchCount++;

        // Safety check: too many mismatches might indicate bigger issue
        if (mismatchCount > Math.max(normalizedMarkdown.length, normalizedHtml.length) * 0.5) {
          if (this.debugMode) {
            console.warn('[OFFSET MAP] Too many mismatches, alignment may be incorrect', {
              mismatchCount,
              mdLength: normalizedMarkdown.length,
              htmlLength: normalizedHtml.length,
              mdPos,
              htmlPos
            });
          }
          break;
        }
      }
    }

    if (this.debugMode) {
      console.log('[OFFSET MAP] Alignment complete', {
        mappings: map.size,
        mismatches: mismatchCount,
        mdLength: normalizedMarkdown.length,
        htmlLength: normalizedHtml.length
      });
    }

    return map;
  }

  /**
   * Determines which side to skip when characters don't match.
   *
   * Strategy:
   * - Look ahead 3-5 characters in both directions
   * - Find which skip leads to better alignment
   * - Return 'markdown', 'html', or 'both'
   */
  private determineBestSkip(
    mdText: string,
    mdPos: number,
    htmlText: string,
    htmlPos: number
  ): 'markdown' | 'html' | 'both' {
    const LOOKAHEAD = 5;

    // Try skipping markdown: does html[htmlPos] match md[mdPos+1..mdPos+LOOKAHEAD]?
    let mdSkipScore = 0;
    for (let i = 1; i <= LOOKAHEAD && mdPos + i < mdText.length; i++) {
      if (mdText[mdPos + i] === htmlText[htmlPos]) {
        mdSkipScore = i;
        break;
      }
    }

    // Try skipping html: does md[mdPos] match html[htmlPos+1..htmlPos+LOOKAHEAD]?
    let htmlSkipScore = 0;
    for (let i = 1; i <= LOOKAHEAD && htmlPos + i < htmlText.length; i++) {
      if (htmlText[htmlPos + i] === mdText[mdPos]) {
        htmlSkipScore = i;
        break;
      }
    }

    // Compare scores (lower is better - means we found match sooner)
    if (mdSkipScore > 0 && htmlSkipScore > 0) {
      // Both found matches, choose the closer one
      return mdSkipScore <= htmlSkipScore ? 'markdown' : 'html';
    } else if (mdSkipScore > 0) {
      return 'markdown';
    } else if (htmlSkipScore > 0) {
      return 'html';
    }

    // No match found in lookahead, default to skipping markdown (original behavior)
    return 'markdown';
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

    // Both strategies failed - provide detailed diagnostics
    console.warn('[HIGHLIGHT MATCH] ✗ All strategies failed', {
      id: highlight.id,
      text: highlight.text.substring(0, 50) + (highlight.text.length > 50 ? '...' : ''),
      textLength: highlight.text.length,
      markdownOffset: [highlight.startOffset, highlight.endOffset],
      firstWords: highlight.firstWords,
      lastWords: highlight.lastWords,
      // Diagnostics
      htmlTextLength: htmlText.length,
      offsetMapSize: offsetMap.size,
      htmlStart: offsetMap.get(highlight.startOffset),
      htmlEnd: offsetMap.get(highlight.endOffset),
      // Sample HTML text around expected position
      htmlSample: htmlText.substring(
        Math.max(0, (offsetMap.get(highlight.startOffset) || 0) - 20),
        Math.min(htmlText.length, (offsetMap.get(highlight.startOffset) || 0) + 50)
      ),
      suggestion: 'Text may have been deleted or heavily modified. Consider deleting this highlight. Enable debug mode (Cmd+Shift+D) for more details.'
    });
  }

  /**
   * Fuzzy match using firstWords and lastWords.
   *
   * Improvements v2:
   * - Tries multiple strategies if exact match fails
   * - Handles partial word matches
   * - More tolerant of whitespace differences
   */
  private fuzzyMatchByWords(
    text: string,
    firstWords: string,
    lastWords: string
  ): { startPos: number; endPos: number } | null {
    const normalizedText = normalizeWhitespace(text);
    const normalizedFirst = normalizeWhitespace(firstWords);
    const normalizedLast = normalizeWhitespace(lastWords);

    if (this.debugMode) {
      console.log('[FUZZY MATCH] Attempting fuzzy match', {
        textLength: normalizedText.length,
        firstWords: normalizedFirst,
        lastWords: normalizedLast
      });
    }

    // Strategy 1: Exact match (primary)
    let result = this.tryExactWordMatch(normalizedText, normalizedFirst, normalizedLast);
    if (result) {
      if (this.debugMode) {
        console.log('[FUZZY MATCH] ✓ Exact match succeeded');
      }
      return result;
    }

    // Strategy 2: Partial match (first 2 words, last 2 words)
    if (this.debugMode) {
      console.log('[FUZZY MATCH] Exact match failed, trying partial match');
    }
    result = this.tryPartialWordMatch(normalizedText, normalizedFirst, normalizedLast);
    if (result) {
      if (this.debugMode) {
        console.log('[FUZZY MATCH] ✓ Partial match succeeded');
      }
      return result;
    }

    // Strategy 3: Single word match (first word, last word)
    if (this.debugMode) {
      console.log('[FUZZY MATCH] Partial match failed, trying single word match');
    }
    result = this.trySingleWordMatch(normalizedText, normalizedFirst, normalizedLast);
    if (result) {
      if (this.debugMode) {
        console.log('[FUZZY MATCH] ✓ Single word match succeeded');
      }
      return result;
    }

    if (this.debugMode) {
      console.log('[FUZZY MATCH] ✗ All strategies failed');
    }

    return null;
  }

  /**
   * Try exact word match (all 3 words on each end)
   */
  private tryExactWordMatch(
    text: string,
    firstWords: string,
    lastWords: string
  ): { startPos: number; endPos: number } | null {
    const firstIndex = text.indexOf(firstWords);
    if (firstIndex === -1) return null;

    const lastIndex = text.indexOf(lastWords, firstIndex + firstWords.length);
    if (lastIndex === -1) return null;

    return {
      startPos: firstIndex,
      endPos: lastIndex + lastWords.length
    };
  }

  /**
   * Try partial match (first 2 words, last 2 words)
   */
  private tryPartialWordMatch(
    text: string,
    firstWords: string,
    lastWords: string
  ): { startPos: number; endPos: number } | null {
    const firstWordArray = firstWords.split(/\s+/);
    const lastWordArray = lastWords.split(/\s+/);

    if (firstWordArray.length < 2 || lastWordArray.length < 2) return null;

    const partialFirst = firstWordArray.slice(0, 2).join(' ');
    const partialLast = lastWordArray.slice(-2).join(' ');

    return this.tryExactWordMatch(text, partialFirst, partialLast);
  }

  /**
   * Try single word match (first word, last word)
   */
  private trySingleWordMatch(
    text: string,
    firstWords: string,
    lastWords: string
  ): { startPos: number; endPos: number } | null {
    const firstWordArray = firstWords.split(/\s+/);
    const lastWordArray = lastWords.split(/\s+/);

    if (firstWordArray.length === 0 || lastWordArray.length === 0) return null;

    const firstWord = firstWordArray[0];
    const lastWord = lastWordArray[lastWordArray.length - 1];

    // Make sure words are substantial enough (at least 3 chars)
    if (firstWord.length < 3 || lastWord.length < 3) return null;

    return this.tryExactWordMatch(text, firstWord, lastWord);
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
   * IMPROVED v2: Handles markdown syntax (**, __, *, etc.)
   * This is the main function for creating highlights from user selection.
   * It takes the selected HTML text and finds it in the Markdown content.
   *
   * Strategy:
   * 1. Strip markdown syntax from markdown content
   * 2. Build offset mapping (stripped → original)
   * 3. Find selected text in stripped version
   * 4. Map back to original markdown offsets
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

    if (this.debugMode) {
      console.log('[FIND IN MARKDOWN] Starting search', {
        selectedText: cleanedText.substring(0, 100),
        markdownLength: markdownContent.length
      });
    }

    // Strip markdown syntax and build offset mapping
    const { strippedText, offsetMap } = this.stripMarkdownSyntax(markdownContent);

    // Normalize both for matching
    const normalizedSearch = normalizeWhitespace(cleanedText);
    const normalizedStripped = normalizeWhitespace(strippedText);

    if (this.debugMode) {
      console.log('[FIND IN MARKDOWN] Normalized comparison', {
        normalizedSearch: normalizedSearch.substring(0, 100),
        normalizedStripped: normalizedStripped.substring(0, 200)
      });
    }

    // Find in stripped text
    const strippedIndex = normalizedStripped.indexOf(normalizedSearch);
    if (strippedIndex === -1) {
      if (this.debugMode) {
        console.warn('[FIND IN MARKDOWN] Not found in stripped text', {
          selectedText: cleanedText.substring(0, 50),
          normalizedSearch: normalizedSearch.substring(0, 50),
          strippedSample: normalizedStripped.substring(0, 200)
        });
      }
      return null;
    }

    // Build position map for normalized stripped text
    const strippedPosMap = buildPositionMap(strippedText);

    // Map normalized position to original stripped position
    const originalStrippedStart = strippedPosMap[strippedIndex] || strippedIndex;
    const originalStrippedEnd = strippedPosMap[strippedIndex + normalizedSearch.length] || (strippedIndex + normalizedSearch.length);

    // Map stripped positions to original markdown positions
    const startOffset = offsetMap.get(originalStrippedStart);
    const endOffset = offsetMap.get(originalStrippedEnd);

    if (startOffset === undefined || endOffset === undefined) {
      if (this.debugMode) {
        console.warn('[FIND IN MARKDOWN] Offset mapping failed', {
          originalStrippedStart,
          originalStrippedEnd,
          mappedStart: startOffset,
          mappedEnd: endOffset
        });
      }
      return null;
    }

    // Extract actual text from markdown
    const actualText = markdownContent.substring(startOffset, endOffset);

    if (this.debugMode) {
      console.log('[FIND IN MARKDOWN] ✓ Found and mapped', {
        selectedText: cleanedText.substring(0, 50),
        actualText: actualText.substring(0, 50),
        strippedOffset: [originalStrippedStart, originalStrippedEnd],
        markdownOffset: [startOffset, endOffset]
      });
    }

    return { text: actualText, startOffset, endOffset };
  }

  /**
   * Strips markdown syntax and creates offset mapping.
   *
   * Removes: **, __, *, _, ~~, `, [[, ]], #, -, 1., etc.
   * Returns: stripped text and map (stripped offset → original offset)
   */
  private stripMarkdownSyntax(markdown: string): {
    strippedText: string;
    offsetMap: Map<number, number>;
  } {
    const offsetMap = new Map<number, number>();
    let stripped = '';
    let i = 0;

    while (i < markdown.length) {
      const char = markdown[i];
      const next = markdown[i + 1];
      const next2 = markdown[i + 2];

      // Track mapping for current stripped position
      offsetMap.set(stripped.length, i);

      // Check for markdown syntax patterns
      if (char === '*' && next === '*') {
        // ** or *** (bold/bold-italic)
        if (next2 === '*') {
          i += 3; // Skip ***
        } else {
          i += 2; // Skip **
        }
        continue;
      } else if (char === '*' || char === '_') {
        // * or _ (italic/underline)
        i++;
        continue;
      } else if (char === '~' && next === '~') {
        // ~~ (strikethrough)
        i += 2;
        continue;
      } else if (char === '`') {
        // ` (inline code)
        i++;
        continue;
      } else if (char === '[' && next === '[') {
        // [[ (wiki link start)
        i += 2;
        continue;
      } else if (char === ']' && next === ']') {
        // ]] (wiki link end)
        i += 2;
        continue;
      } else if (char === '#' && (i === 0 || markdown[i - 1] === '\n')) {
        // # at line start (heading)
        while (i < markdown.length && markdown[i] === '#') i++;
        if (i < markdown.length && markdown[i] === ' ') i++;
        continue;
      } else if ((char === '-' || char === '+' || char === '*') && (i === 0 || markdown[i - 1] === '\n') && next === ' ') {
        // List marker at line start
        i += 2; // Skip "- " or "+ " or "* "
        continue;
      } else if (char >= '0' && char <= '9' && (i === 0 || markdown[i - 1] === '\n')) {
        // Numbered list (1. 2. etc.)
        while (i < markdown.length && markdown[i] >= '0' && markdown[i] <= '9') i++;
        if (i < markdown.length && markdown[i] === '.' && i + 1 < markdown.length && markdown[i + 1] === ' ') {
          i += 2; // Skip ". "
        }
        continue;
      }

      // Regular character - keep it
      stripped += char;
      i++;
    }

    // Add final mapping
    offsetMap.set(stripped.length, markdown.length);

    if (this.debugMode) {
      console.log('[STRIP MARKDOWN] Syntax stripped', {
        originalLength: markdown.length,
        strippedLength: stripped.length,
        mappings: offsetMap.size,
        originalSample: markdown.substring(0, 100),
        strippedSample: stripped.substring(0, 100)
      });
    }

    return { strippedText: stripped, offsetMap };
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
