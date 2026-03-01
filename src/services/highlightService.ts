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

/**
 * Builds a word index for O(1) word lookup.
 * Maps each word to all positions where it appears in the normalized text.
 *
 * This optimization reduces highlight matching from O(H*N) to O(H+N):
 * - Without index: Each highlight searches entire text = H highlights × N chars
 * - With index: Build index once (N), then O(1) lookup per highlight (H)
 *
 * @example
 * const text = 'the quick brown fox jumps over the lazy dog';
 * const index = buildWordIndex(normalizeWhitespace(text));
 * index.get('the') // [0, 32] (positions where 'the' starts)
 */
export function buildWordIndex(normalizedText: string): Map<string, number[]> {
  const wordIndex = new Map<string, number[]>();
  const words = normalizedText.split(/\s+/);
  let currentPos = 0;

  words.forEach(word => {
    if (word.length > 0) {
      const positions = wordIndex.get(word) || [];
      positions.push(currentPos);
      wordIndex.set(word, positions);
      currentPos += word.length + 1; // +1 for space
    }
  });

  return wordIndex;
}

// ============================================================================
// Matching Strategy Functions (exported for testing)
// ============================================================================

/**
 * Matches text using first/last words anchors (most robust strategy).
 *
 * This is the primary matching strategy because:
 * 1. Resilient to minor edits in the middle of text
 * 2. Fast with word index (O(1) lookup for first word)
 * 3. Unique anchor points reduce false positives
 *
 * @returns Object with startPos/endPos in original text, or null if not found
 */
export function matchByFirstLastWords(
  normalizedText: string,
  _fullText: string, // Unused but kept for API consistency
  firstWords: string,
  lastWords: string,
  positionMap: number[],
  wordIndex: Map<string, number[]>
): { startPos: number; endPos: number } | null {
  const normalizedFirstWords = normalizeWhitespace(firstWords);
  const normalizedLastWords = normalizeWhitespace(lastWords);

  // OPTIMIZATION: Try word index first for faster lookup
  const firstWord = normalizedFirstWords.split(/\s+/)[0];
  let firstWordsIndex = -1;

  // Fast path: Use word index
  const firstWordPositions = wordIndex.get(firstWord);
  if (firstWordPositions && firstWordPositions.length > 0) {
    for (const pos of firstWordPositions) {
      if (normalizedText.substring(pos, pos + normalizedFirstWords.length) === normalizedFirstWords) {
        firstWordsIndex = pos;
        break;
      }
    }
  }

  // Fallback to indexOf if word index didn't work
  if (firstWordsIndex === -1) {
    firstWordsIndex = normalizedText.indexOf(normalizedFirstWords);
  }

  if (firstWordsIndex === -1) {
    return null;
  }

  // Find last words after first words
  const lastWordsIndex = normalizedText.indexOf(
    normalizedLastWords,
    firstWordsIndex + normalizedFirstWords.length
  );

  if (lastWordsIndex === -1) {
    return null;
  }

  // Map normalized positions back to original text positions
  const startPos = positionMap[firstWordsIndex] || firstWordsIndex;
  const endPos = positionMap[lastWordsIndex + normalizedLastWords.length] || (lastWordsIndex + normalizedLastWords.length);

  return { startPos, endPos };
}

/**
 * Matches text using context before/after (fallback strategy).
 *
 * Used when firstWords/lastWords are not available.
 * Less robust than anchor-based matching but better than text-only search.
 *
 * @returns Start position in original text, or -1 if not found
 */
export function matchByContext(
  fullText: string,
  normalizedText: string,
  searchText: string,
  contextBefore: string,
  contextAfter: string,
  positionMap: number[]
): number {
  // Try exact match first
  const pattern = contextBefore + searchText + contextAfter;
  let patternIndex = fullText.indexOf(pattern);

  if (patternIndex !== -1) {
    return patternIndex + contextBefore.length;
  }

  // Try normalized whitespace match
  const normalizedPattern = normalizeWhitespace(pattern);
  const normalizedIndex = normalizedText.indexOf(normalizedPattern);

  if (normalizedIndex !== -1) {
    const patternStartInOriginal = positionMap[normalizedIndex] || 0;
    const normalizedContextLength = normalizeWhitespace(contextBefore).length;
    const textStartInNormalized = normalizedIndex + normalizedContextLength;
    const textStartInOriginal = positionMap[textStartInNormalized] || patternStartInOriginal;
    return textStartInOriginal;
  }

  return -1;
}

/**
 * Fuzzy text matching that handles whitespace/punctuation differences.
 *
 * This is the last-resort strategy when exact matching fails.
 * Handles cases where HTML rendering removes spaces after punctuation.
 *
 * Algorithm:
 * - Advances through both texts simultaneously
 * - Skips whitespace mismatches
 * - Fails on character mismatches
 *
 * @returns Position where match starts, or -1 if no match
 */
export function fuzzyMatch(text: string, search: string, startPos: number): number {
  let textPos = startPos;
  let searchPos = 0;

  while (searchPos < search.length && textPos < text.length) {
    const searchChar = search[searchPos];
    const textChar = text[textPos];

    if (searchChar === textChar) {
      searchPos++;
      textPos++;
    } else if (/\s/.test(searchChar)) {
      searchPos++;
    } else if (/\s/.test(textChar)) {
      textPos++;
    } else {
      return -1;
    }
  }

  return searchPos >= search.length ? startPos : -1;
}

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
   * Applies highlights to HTML content.
   *
   * This is the main entry point for rendering highlights.
   * Uses a 3-tier fallback strategy:
   * 1. firstWords/lastWords matching (most robust)
   * 2. Context-based matching
   * 3. Fuzzy matching (handles whitespace differences)
   *
   * Complexity: O(H+N) where H = highlights, N = text length
   * - Pre-computes position map and word index once
   * - Each highlight uses O(1) word index lookup
   *
   * @param html - HTML string to apply highlights to
   * @param highlights - Array of highlight objects
   * @param visible - Whether highlights should be visible
   * @returns Modified HTML with <mark> elements
   */
  applyHighlightsToHtml(html: string, highlights: Highlight[], visible: boolean): string {
    if (!highlights || highlights.length === 0 || !visible) return html;

    // Create temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // FIX: Add spaces between block elements to preserve structure
    // Without this, <li>A</li><li>B</li> becomes "AB" instead of "A B"
    this.insertSpacesBetweenBlocks(tempDiv);

    const fullText = tempDiv.textContent || '';

    if (this.debugMode) {
      console.log('[HIGHLIGHT RENDER] Starting highlight rendering', {
        highlightCount: highlights.length,
        fullTextLength: fullText.length,
        fullTextPreview: fullText.substring(0, 200),
        htmlPreview: html.substring(0, 200)
      });
    }

    // OPTIMIZATION: Pre-compute once for all highlights (O(N) instead of O(H*N))
    const normalizedText = normalizeWhitespace(fullText);
    const positionMap = buildPositionMap(fullText);
    const wordIndex = buildWordIndex(normalizedText);

    if (this.debugMode) {
      console.log('[HIGHLIGHT RENDER] Text analysis', {
        normalizedTextPreview: normalizedText.substring(0, 200),
        wordIndexSize: wordIndex.size,
        positionMapLength: positionMap.length
      });
    }

    // Process each highlight with fallback strategies
    highlights.forEach(h => {
      this.processHighlight(tempDiv, fullText, normalizedText, positionMap, wordIndex, h);
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
   * Processes a single highlight with fallback strategies.
   */
  private processHighlight(
    container: HTMLElement,
    fullText: string,
    normalizedText: string,
    positionMap: number[],
    wordIndex: Map<string, number[]>,
    highlight: Highlight
  ): void {
    // Strategy 1: firstWords/lastWords (most robust)
    if (highlight.firstWords && highlight.lastWords) {
      if (this.debugMode) {
        console.log('[HIGHLIGHT MATCH] Attempting firstWords/lastWords', {
          id: highlight.id,
          firstWords: highlight.firstWords,
          lastWords: highlight.lastWords
        });
      }

      const match = matchByFirstLastWords(
        normalizedText,
        fullText,
        highlight.firstWords,
        highlight.lastWords,
        positionMap,
        wordIndex
      );

      if (match) {
        if (this.debugMode) {
          console.log('[HIGHLIGHT MATCH] ✓ Found', {
            id: highlight.id,
            strategy: 'firstWords/lastWords',
            startPos: match.startPos,
            endPos: match.endPos,
            matchedText: fullText.substring(match.startPos, match.endPos)
          });
        }
        this.applyHighlightToNodes(container, highlight.text, match.startPos, highlight, match.endPos);
        return;
      }

      console.warn('[HIGHLIGHT MATCH] ✗ Failed to find firstWords/lastWords', {
        id: highlight.id,
        savedText: highlight.text,
        firstWords: highlight.firstWords,
        lastWords: highlight.lastWords,
        contextBefore: highlight.contextBefore,
        contextAfter: highlight.contextAfter,
        normalizedTextPreview: normalizedText.substring(0, 300),
        fullTextPreview: fullText.substring(0, 300),
        suggestion: 'Text might have been in a list/table that was reformatted'
      });
      return;
    }

    // Strategy 2: Context-based matching
    if (highlight.contextBefore || highlight.contextAfter) {
      if (this.debugMode) {
        console.log('[HIGHLIGHT MATCH] Attempting context match', {
          id: highlight.id,
          contextBefore: highlight.contextBefore?.substring(0, 20),
          contextAfter: highlight.contextAfter?.substring(0, 20)
        });
      }

      const startPos = matchByContext(
        fullText,
        normalizedText,
        highlight.text,
        highlight.contextBefore || '',
        highlight.contextAfter || '',
        positionMap
      );

      if (startPos !== -1) {
        if (this.debugMode) {
          console.log('[HIGHLIGHT MATCH] ✓ Found via context', {
            id: highlight.id,
            strategy: 'context',
            startPos
          });
        }
        this.applyHighlightToNodes(container, highlight.text, startPos, highlight);
        return;
      }
    }

    // Strategy 3: Fuzzy matching (last resort)
    const normalizedSearchText = normalizeWhitespace(highlight.text);
    const searchWords = normalizedSearchText.split(' ').filter(w => w.length > 2);
    const sortedWords = [...searchWords].sort((a, b) => b.length - a.length);
    const uniqueWord = sortedWords[0];

    if (uniqueWord) {
      const uniqueWordIndex = normalizedText.indexOf(uniqueWord);

      if (uniqueWordIndex !== -1) {
        if (this.debugMode) {
          console.log('[HIGHLIGHT MATCH] Attempting fuzzy match', {
            id: highlight.id,
            uniqueWord,
            startPos: uniqueWordIndex
          });
        }

        const fuzzyMatchPos = fuzzyMatch(normalizedText, normalizedSearchText, uniqueWordIndex);

        if (fuzzyMatchPos !== -1) {
          const textIndex = positionMap[fuzzyMatchPos] || fuzzyMatchPos;
          if (this.debugMode) {
            console.log('[HIGHLIGHT MATCH] ✓ Found via fuzzy', {
              id: highlight.id,
              strategy: 'fuzzy',
              startPos: textIndex
            });
          }
          this.applyHighlightToNodes(container, highlight.text, textIndex, highlight);
          return;
        }
      }
    }

    console.warn('[HIGHLIGHT MATCH] ✗ All strategies failed', {
      id: highlight.id,
      text: highlight.text.substring(0, 50),
      normalizedText: normalizedSearchText.substring(0, 50)
    });
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
   * Extracts context before/after a text selection for robust matching.
   *
   * @param plainText - Full plain text content
   * @param startOffset - Start offset of selection
   * @param endOffset - End offset of selection
   * @param contextLength - Number of characters to extract (default: 20)
   */
  extractHighlightContext(
    plainText: string,
    startOffset: number,
    endOffset: number,
    contextLength: number = 20
  ): { contextBefore: string; contextAfter: string } {
    const contextBefore = plainText.substring(Math.max(0, startOffset - contextLength), startOffset);
    const contextAfter = plainText.substring(endOffset, Math.min(plainText.length, endOffset + contextLength));
    return { contextBefore, contextAfter };
  }

  /**
   * Calculates text offsets from a DOM Range.
   *
   * Converts a user's text selection (Range) into plain text offsets,
   * accounting for leading/trailing whitespace.
   *
   * @param range - DOM Range object from user selection
   * @param containerEl - Container element to calculate offsets within
   */
  calculateTextOffsets(
    range: Range,
    containerEl: HTMLElement
  ): {
    startOffset: number;
    endOffset: number;
    trimmedText: string;
    leadingSpaces: number;
  } {
    const rawText = range.toString();

    // Calculate raw start offset
    const beforeRange = document.createRange();
    beforeRange.setStart(containerEl, 0);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    const rawStartOffset = beforeRange.toString().length;

    // Trim and adjust offsets
    const trimmedText = rawText.trim();
    const leadingSpaces = rawText.length - rawText.trimStart().length;
    const startOffset = rawStartOffset + leadingSpaces;
    const endOffset = startOffset + trimmedText.length;

    return { startOffset, endOffset, trimmedText, leadingSpaces };
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
