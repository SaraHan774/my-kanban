import { useState, useEffect, useRef, useCallback } from 'react';
import './FindBar.css';

interface FindBarProps {
  onClose: () => void;
  contentRef: React.RefObject<HTMLDivElement | null>;  // for preview mode highlighting
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;  // for edit mode
  highlightOverlayRef?: React.RefObject<HTMLDivElement | null>;  // for edit mode overlay highlighting
  content?: string;  // raw markdown content for edit mode search
}

interface MatchInfo {
  total: number;
  current: number;  // 1-based index, 0 means no current match
}

/**
 * Remove all <mark> highlight elements from a container,
 * restoring the original text nodes.
 */
function clearHighlights(container: HTMLElement): void {
  const marks = container.querySelectorAll('mark[data-find-highlight]');
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    const textNode = document.createTextNode(mark.textContent || '');
    parent.replaceChild(textNode, mark);
    parent.normalize();
  });
}

/**
 * Walk all text nodes inside `container`, wrapping case-insensitive matches
 * of `query` in <mark> elements. Returns the total number of matches found.
 */
function highlightMatches(container: HTMLElement, query: string): number {
  if (!query) return 0;

  const lowerQuery = query.toLowerCase();
  let matchCount = 0;

  // Collect text nodes using TreeWalker (skip script/style elements)
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node: Node): number {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'noscript') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  // Process text nodes in reverse so DOM mutations don't shift indices
  for (let i = textNodes.length - 1; i >= 0; i--) {
    const textNode = textNodes[i];
    const text = textNode.textContent || '';
    const lowerText = text.toLowerCase();
    const parent = textNode.parentNode;
    if (!parent) continue;

    // Find all match positions within this text node
    const positions: Array<{ start: number; end: number }> = [];
    let searchFrom = 0;
    while (searchFrom < lowerText.length) {
      const idx = lowerText.indexOf(lowerQuery, searchFrom);
      if (idx === -1) break;
      positions.push({ start: idx, end: idx + query.length });
      searchFrom = idx + 1;  // allow overlapping in edge cases
    }

    if (positions.length === 0) continue;
    matchCount += positions.length;

    // Build replacement fragment
    const fragment = document.createDocumentFragment();
    let lastEnd = 0;

    for (const pos of positions) {
      // Text before this match
      if (pos.start > lastEnd) {
        fragment.appendChild(document.createTextNode(text.slice(lastEnd, pos.start)));
      }
      // The match wrapped in <mark>
      const mark = document.createElement('mark');
      mark.setAttribute('data-find-highlight', 'true');
      mark.className = 'find-highlight';
      mark.textContent = text.slice(pos.start, pos.end);
      fragment.appendChild(mark);
      lastEnd = pos.end;
    }

    // Remaining text after last match
    if (lastEnd < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastEnd)));
    }

    parent.replaceChild(fragment, textNode);
  }

  return matchCount;
}

/**
 * Set the n-th (0-based) highlight mark as the current match.
 * Removes `.current-match` from all others, adds it to the target,
 * and scrolls it into view.
 */
function setCurrentHighlight(container: HTMLElement, index: number): void {
  const marks = container.querySelectorAll<HTMLElement>('mark[data-find-highlight]');
  marks.forEach((m, i) => {
    if (i === index) {
      m.classList.add('current-match');
      m.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      m.classList.remove('current-match');
    }
  });
}

export function FindBar({ onClose, contentRef, textareaRef, highlightOverlayRef, content }: FindBarProps) {
  const [query, setQuery] = useState('');
  const [matchInfo, setMatchInfo] = useState<MatchInfo>({ total: 0, current: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the search input on mount
  useEffect(() => {
    // Small delay to ensure the element is rendered
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Determine if we are operating in edit mode (textarea) vs preview mode (contentRef)
  const isEditMode = !!(textareaRef?.current && content !== undefined);

  // ---- Preview mode: highlight with <mark> elements ----
  const performPreviewSearch = useCallback((searchQuery: string) => {
    const container = contentRef.current;
    if (!container) return;

    // Clear previous highlights
    clearHighlights(container);

    if (!searchQuery) {
      setMatchInfo({ total: 0, current: 0 });
      return;
    }

    const total = highlightMatches(container, searchQuery);
    if (total > 0) {
      setCurrentHighlight(container, 0);
      setMatchInfo({ total, current: 1 });
    } else {
      setMatchInfo({ total: 0, current: 0 });
    }
  }, [contentRef]);

  // ---- Edit mode: find indices in raw content, use setSelectionRange ----
  const editMatchIndices = useRef<Array<{ start: number; end: number }>>([]);

  // Render highlights in the overlay for edit mode
  const renderEditOverlayHighlights = useCallback((searchQuery: string, currentIndex: number) => {
    const overlay = highlightOverlayRef?.current;
    if (!overlay || !content) return;

    if (!searchQuery) {
      overlay.innerHTML = '';
      return;
    }

    const lowerContent = content.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    let html = '';
    let lastIndex = 0;
    let matchIndex = 0;

    let searchFrom = 0;
    while (searchFrom < lowerContent.length) {
      const idx = lowerContent.indexOf(lowerQuery, searchFrom);
      if (idx === -1) break;

      // Text before match
      html += escapeHtml(content.substring(lastIndex, idx));

      // The match
      const matchText = content.substring(idx, idx + searchQuery.length);
      const isCurrentMatch = matchIndex === currentIndex;
      html += `<mark class="find-highlight${isCurrentMatch ? ' current-match' : ''}">${escapeHtml(matchText)}</mark>`;

      lastIndex = idx + searchQuery.length;
      searchFrom = idx + 1;
      matchIndex++;
    }

    // Remaining text
    html += escapeHtml(content.substring(lastIndex));
    overlay.innerHTML = html;
  }, [content, highlightOverlayRef]);

  // Helper function to escape HTML
  const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const performEditSearch = useCallback((searchQuery: string) => {
    if (!content || !searchQuery) {
      editMatchIndices.current = [];
      setMatchInfo({ total: 0, current: 0 });
      renderEditOverlayHighlights('', 0);
      return;
    }

    const lowerContent = content.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    const indices: Array<{ start: number; end: number }> = [];
    let searchFrom = 0;

    while (searchFrom < lowerContent.length) {
      const idx = lowerContent.indexOf(lowerQuery, searchFrom);
      if (idx === -1) break;
      indices.push({ start: idx, end: idx + searchQuery.length });
      searchFrom = idx + 1;
    }

    editMatchIndices.current = indices;

    if (indices.length > 0) {
      setMatchInfo({ total: indices.length, current: 1 });
      selectEditMatch(0);
      renderEditOverlayHighlights(searchQuery, 0);
    } else {
      setMatchInfo({ total: 0, current: 0 });
      renderEditOverlayHighlights(searchQuery, -1);
    }
  }, [content, renderEditOverlayHighlights]);

  const selectEditMatch = useCallback((index: number) => {
    const textarea = textareaRef?.current;
    if (!textarea) return;

    const match = editMatchIndices.current[index];
    if (!match) return;

    // Set selection without focusing textarea, so user can continue typing in FindBar
    textarea.setSelectionRange(match.start, match.end);

    // Scroll the textarea to show the selection.
    // We estimate the line the match is on and adjust scrollTop.
    const textBefore = (content || '').substring(0, match.start);
    const lineNumber = textBefore.split('\n').length;
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 24;
    const targetScroll = (lineNumber - 1) * lineHeight - textarea.clientHeight / 2;
    textarea.scrollTop = Math.max(0, targetScroll);
  }, [textareaRef, content]);

  // Perform search whenever query changes
  useEffect(() => {
    if (isEditMode) {
      performEditSearch(query);
    } else {
      performPreviewSearch(query);
    }
  }, [query, isEditMode, performEditSearch, performPreviewSearch]);

  // Clean up highlights on unmount (for preview mode and edit overlay)
  useEffect(() => {
    return () => {
      const container = contentRef.current;
      if (container) {
        clearHighlights(container);
      }
      const overlay = highlightOverlayRef?.current;
      if (overlay) {
        overlay.innerHTML = '';
      }
    };
  }, [contentRef, highlightOverlayRef]);

  // Navigation: go to next match
  const goToNext = useCallback(() => {
    if (matchInfo.total === 0) return;

    const nextIndex = matchInfo.current >= matchInfo.total ? 1 : matchInfo.current + 1;
    setMatchInfo((prev) => ({ ...prev, current: nextIndex }));

    if (isEditMode) {
      selectEditMatch(nextIndex - 1);
      renderEditOverlayHighlights(query, nextIndex - 1);
    } else {
      const container = contentRef.current;
      if (container) {
        setCurrentHighlight(container, nextIndex - 1);
      }
    }
  }, [matchInfo, isEditMode, selectEditMatch, contentRef, renderEditOverlayHighlights, query]);

  // Navigation: go to previous match
  const goToPrev = useCallback(() => {
    if (matchInfo.total === 0) return;

    const prevIndex = matchInfo.current <= 1 ? matchInfo.total : matchInfo.current - 1;
    setMatchInfo((prev) => ({ ...prev, current: prevIndex }));

    if (isEditMode) {
      selectEditMatch(prevIndex - 1);
      renderEditOverlayHighlights(query, prevIndex - 1);
    } else {
      const container = contentRef.current;
      if (container) {
        setCurrentHighlight(container, prevIndex - 1);
      }
    }
  }, [matchInfo, isEditMode, selectEditMatch, contentRef, renderEditOverlayHighlights, query]);

  // Handle keyboard events on the input
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        goToPrev();
      } else {
        goToNext();
      }
    }
  }, [onClose, goToNext, goToPrev]);

  const matchDisplay = matchInfo.total > 0
    ? `${matchInfo.current} of ${matchInfo.total}`
    : query
      ? 'No matches'
      : '';

  return (
    <div className="find-bar" role="search" aria-label="Find in page">
      <div className="find-bar-inner">
        <input
          ref={inputRef}
          type="text"
          className="find-bar-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Find in page..."
          aria-label="Search text"
        />
        {matchDisplay && (
          <span className="find-bar-count" aria-live="polite">
            {matchDisplay}
          </span>
        )}
        <div className="find-bar-buttons">
          <button
            className="find-bar-btn"
            onClick={goToPrev}
            disabled={matchInfo.total === 0}
            title="Previous match (Shift+Enter)"
            aria-label="Previous match"
          >
            <span className="material-symbols-outlined">keyboard_arrow_up</span>
          </button>
          <button
            className="find-bar-btn"
            onClick={goToNext}
            disabled={matchInfo.total === 0}
            title="Next match (Enter)"
            aria-label="Next match"
          >
            <span className="material-symbols-outlined">keyboard_arrow_down</span>
          </button>
          <button
            className="find-bar-btn find-bar-close"
            onClick={onClose}
            title="Close (Escape)"
            aria-label="Close find bar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>
    </div>
  );
}
