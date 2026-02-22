import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { pageService, markdownService, resolveImagesInHtml, clearImageCache } from '@/services';
import { Page, Highlight, Memo } from '@/types';
import { PageEditor } from '@/components/PageEditor';
import { FindBar } from '@/components/FindBar';
import { ConfirmModal } from '@/components/ConfirmModal';
import { HighlightPalette } from '@/components/HighlightPalette';
import { HighlightHoverMenu } from '@/components/HighlightHoverMenu';
import { MemoPanel } from '@/components/MemoPanel';
import { Terminal } from '@/components/Terminal';
import { useMermaid } from '@/hooks/useMermaid';
import { convertWikiLinksToMarkdown } from '@/utils/wikiLinks';
import { openExternalUrl } from '@/lib/openExternal';
import { getHighlightColor, getUnderlineColor } from '@/utils/colorAdjust';
import './PageView.css';

export function PageView() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { pages, removePage, updatePageInStore, columnColors, showToast, highlightColors, config, isImmerseMode, setIsImmerseMode } = useStore();
  const [page, setPage] = useState<Page | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [showFindBar, setShowFindBar] = useState(false);
  const [zoomedDiagram, setZoomedDiagram] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showHighlightPalette, setShowHighlightPalette] = useState(false);
  const [palettePosition, setPalettePosition] = useState({ top: 0, left: 0 });
  const [highlightsVisible, setHighlightsVisible] = useState(true);
  const selectedRangeRef = useRef<Range | null>(null);
  const [showHoverMenu, setShowHoverMenu] = useState(false);
  const [hoverMenuPosition, setHoverMenuPosition] = useState({ top: 0, left: 0 });
  const [hoveredHighlightId, setHoveredHighlightId] = useState<string | null>(null);
  const isMouseOverMenuRef = useRef(false);
  const closeMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const [showTerminal, setShowTerminal] = useState(false);
  const [showPageMenu, setShowPageMenu] = useState(false);
  const pageMenuRef = useRef<HTMLDivElement>(null);
  const [memoMode, setMemoMode] = useState(false);
  const [memoPanelWidth, setMemoPanelWidth] = useState(500); // Default 500px
  const isResizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);
  const [themeVersion, setThemeVersion] = useState(0); // Track theme changes for highlight re-rendering
  const [lastCreatedMemoId, setLastCreatedMemoId] = useState<string | null>(null);

  // Render mermaid diagrams after HTML content updates
  useMermaid(contentRef, htmlContent);

  // Auto-clear lastCreatedMemoId after scroll completes
  useEffect(() => {
    if (lastCreatedMemoId) {
      const timer = setTimeout(() => {
        setLastCreatedMemoId(null);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [lastCreatedMemoId]);

  // Clean up blob URLs on unmount or page change
  useEffect(() => {
    return () => { clearImageCache(); };
  }, [pageId]);

  useEffect(() => {
    if (pageId) {
      loadPage(pageId);
      setEditing(false);
      setLastCreatedMemoId(null);
      // Reset scroll position to top when navigating to a new page
      window.scrollTo(0, 0);
    }
  }, [pageId]);

  // Retry when pages become available (e.g., after refresh restores file system access)
  useEffect(() => {
    if (pageId && !page && !loading && pages.length > 0) {
      loadPage(pageId);
    }
  }, [pages.length]);

  const loadPage = async (id: string) => {
    setLoading(true);
    try {
      const foundPage = pages.find(p => p.id === id);
      if (foundPage) {
        const fullPage = await pageService.loadPageWithChildren(foundPage.path);
        setPage(fullPage);
        // Convert wiki-style links before rendering markdown
        const contentWithLinks = convertWikiLinksToMarkdown(fullPage.content, pages);
        let html = await markdownService.toHtml(contentWithLinks);
        html = await resolveImagesInHtml(html, fullPage.path);
        // Apply highlights
        html = applyHighlightsToHtml(html, fullPage.highlights || []);
        setHtmlContent(html);
      }
    } catch (error) {
      console.error('Failed to load page:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle the N-th checkbox in markdown content and auto-save
  const handleCheckboxToggle = useCallback(async (checkboxIndex: number) => {
    if (!page) return;

    let idx = 0;
    const newContent = page.content.replace(/- \[([ x])\]/g, (match, state) => {
      if (idx++ === checkboxIndex) {
        return state === 'x' ? '- [ ]' : '- [x]';
      }
      return match;
    });

    const updatedPage = { ...page, content: newContent, updatedAt: new Date().toISOString() };
    setPage(updatedPage);
    updatePageInStore(updatedPage);

    // Convert wiki-style links before rendering markdown
    const contentWithLinks = convertWikiLinksToMarkdown(newContent, pages);
    let html = await markdownService.toHtml(contentWithLinks);
    html = await resolveImagesInHtml(html, page.path);
    html = applyHighlightsToHtml(html, page.highlights || []);
    setHtmlContent(html);

    try {
      await pageService.updatePage(updatedPage);
    } catch (err) {
      console.error('Failed to save checkbox state:', err);
    }
  }, [page, updatePageInStore, pages]);

  // Attach click handlers to internal links for SPA navigation
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const links = container.querySelectorAll<HTMLAnchorElement>('a[href^="/page/"]');
    const handlers: Array<(e: Event) => void> = [];

    links.forEach((link) => {
      const handler = (e: Event) => {
        e.preventDefault();
        const href = link.getAttribute('href');
        if (href) {
          const targetPageId = href.replace('/page/', '');
          // Only navigate if the target page is different from the current page
          if (targetPageId !== pageId) {
            navigate(href);
          }
        }
      };
      link.addEventListener('click', handler);
      handlers.push(handler);
    });

    return () => {
      links.forEach((link, index) => {
        link.removeEventListener('click', handlers[index]);
      });
    };
  }, [htmlContent, navigate, pageId]);

  // Attach click handlers to external links to open in browser
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const externalLinks = container.querySelectorAll<HTMLAnchorElement>('a[href^="http://"], a[href^="https://"]');
    const handlers: Array<(e: Event) => void> = [];

    externalLinks.forEach((link) => {
      const handler = (e: Event) => {
        e.preventDefault();
        const href = link.getAttribute('href');
        if (href) {
          openExternalUrl(href);
        }
      };
      link.addEventListener('click', handler);
      handlers.push(handler);
    });

    return () => {
      externalLinks.forEach((link, index) => {
        link.removeEventListener('click', handlers[index]);
      });
    };
  }, [htmlContent]);

  // Attach click handlers to rendered checkboxes
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const handlers: Array<() => void> = [];

    checkboxes.forEach((cb, index) => {
      cb.disabled = false;
      cb.style.cursor = 'pointer';
      const handler = () => handleCheckboxToggle(index);
      cb.addEventListener('click', handler);
      handlers.push(handler);
    });

    return () => {
      checkboxes.forEach((cb, index) => {
        cb.removeEventListener('click', handlers[index]);
      });
    };
  }, [htmlContent, handleCheckboxToggle]);

  // Attach click handlers to mermaid diagrams for zoom functionality
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const diagrams = container.querySelectorAll<HTMLElement>('.mermaid-block');
    const handlers: Array<() => void> = [];

    diagrams.forEach((diagram) => {
      const handler = () => {
        // Get the SVG content from the diagram
        const svg = diagram.querySelector('svg');
        if (svg) {
          setZoomedDiagram(svg.outerHTML);
        }
      };
      diagram.addEventListener('click', handler);
      handlers.push(handler);
    });

    return () => {
      diagrams.forEach((diagram, index) => {
        diagram.removeEventListener('click', handlers[index]);
      });
    };
  }, [htmlContent]);

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!page) return;
    const pageTitle = page.title;
    setShowDeleteConfirm(false);

    try {
      await pageService.deletePage(page.path);
      removePage(page.id);

      // Show success toast (will persist after navigation)
      showToast(`"${pageTitle}" deleted successfully`, 'success');

      // Navigate to home after a brief delay (replace history since page no longer exists)
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 300);
    } catch (error) {
      console.error('Failed to delete page:', error);
      showToast('Failed to delete page. Please try again.', 'error');
    }
  };

  // Highlight functionality uses colors from store

  const handleTextSelection = useCallback(() => {
    if (editing) return; // Don't show palette in edit mode

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setShowHighlightPalette(false);
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();

    // Ignore selections shorter than 2 characters
    if (selectedText.length < 2) {
      setShowHighlightPalette(false);
      return;
    }

    // Check if selection is within the content area
    const contentEl = contentRef.current;
    if (!contentEl || !contentEl.contains(range.commonAncestorContainer)) {
      setShowHighlightPalette(false);
      return;
    }

    // Store the range for later use
    selectedRangeRef.current = range.cloneRange();

    // Calculate palette position based on selected text position
    // Similar to hover menu positioning
    const rect = range.getBoundingClientRect();
    setPalettePosition({
      top: rect.top + window.scrollY - 55, // 55px above the selection
      left: rect.left + rect.width / 2 - 150, // Center palette horizontally on selection
    });

    setShowHighlightPalette(true);
  }, [editing]);

  const applyHighlight = useCallback(async (color: string, style: 'highlight' | 'underline') => {
    if (!page || !selectedRangeRef.current) return;

    const selection = window.getSelection();
    const rawText = selection?.toString() || '';
    if (!rawText) return;

    const range = selectedRangeRef.current;

    // Calculate text offset in the plain content
    const contentEl = contentRef.current;
    if (!contentEl) return;

    const plainText = contentEl.textContent || '';
    const beforeRange = document.createRange();
    beforeRange.setStart(contentEl, 0);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    const rawStartOffset = beforeRange.toString().length;

    // Trim the text and adjust offsets accordingly
    const trimmedText = rawText.trim();
    const leadingSpaces = rawText.length - rawText.trimStart().length;
    const startOffset = rawStartOffset + leadingSpaces;
    const endOffset = startOffset + trimmedText.length;

    // Get context
    const contextBefore = plainText.substring(Math.max(0, startOffset - 20), startOffset);
    const contextAfter = plainText.substring(endOffset, Math.min(plainText.length, endOffset + 20));

    const highlight: Highlight = {
      id: crypto.randomUUID(),
      text: trimmedText,
      color,
      style,
      startOffset,
      endOffset,
      contextBefore,
      contextAfter,
      createdAt: new Date().toISOString(),
    };

    const updatedHighlights = [...(page.highlights || []), highlight];

    // If memo mode is active, create a linked memo
    let updatedMemos = page.memos || [];
    if (memoMode) {
      const newMemoId = crypto.randomUUID();
      const linkedMemo: Memo = {
        id: newMemoId,
        type: 'linked',
        note: '',
        highlightId: highlight.id,
        highlightText: trimmedText,
        highlightColor: color,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        order: updatedMemos.length,
      };
      updatedMemos = [...updatedMemos, linkedMemo];
      setLastCreatedMemoId(newMemoId);
    }

    const updatedPage = {
      ...page,
      highlights: updatedHighlights,
      memos: updatedMemos,
      updatedAt: new Date().toISOString(),
    };

    setPage(updatedPage);
    updatePageInStore(updatedPage);

    // Re-render with new highlights
    const contentWithLinks = convertWikiLinksToMarkdown(page.content, pages);
    let html = await markdownService.toHtml(contentWithLinks);
    html = await resolveImagesInHtml(html, page.path);
    html = applyHighlightsToHtml(html, updatedHighlights);
    setHtmlContent(html);

    try {
      await pageService.updatePage(updatedPage);
    } catch (err) {
      console.error('Failed to save highlight:', err);
      showToast('Failed to save highlight', 'error');
    }

    // Clear selection
    selection?.removeAllRanges();
    setShowHighlightPalette(false);
  }, [page, pages, updatePageInStore, showToast, memoMode]);

  const handleChangeHighlightColor = useCallback(async (highlightId: string, newColor: string) => {
    if (!page) return;

    const updatedHighlights = (page.highlights || []).map(h =>
      h.id === highlightId ? { ...h, color: newColor } : h
    );

    const updatedPage = {
      ...page,
      highlights: updatedHighlights,
      updatedAt: new Date().toISOString(),
    };

    setPage(updatedPage);
    updatePageInStore(updatedPage);

    // Re-render with updated highlights
    const contentWithLinks = convertWikiLinksToMarkdown(page.content, pages);
    let html = await markdownService.toHtml(contentWithLinks);
    html = await resolveImagesInHtml(html, page.path);
    html = applyHighlightsToHtml(html, updatedHighlights);
    setHtmlContent(html);

    try {
      await pageService.updatePage(updatedPage);
    } catch (err) {
      console.error('Failed to update highlight:', err);
      showToast('Failed to update highlight', 'error');
    }

    setShowHoverMenu(false);
  }, [page, pages, updatePageInStore, showToast]);

  const handleDeleteHighlight = useCallback(async (highlightId: string) => {
    if (!page) return;

    const updatedHighlights = (page.highlights || []).filter(h => h.id !== highlightId);
    // Also delete any linked memos
    const updatedMemos = (page.memos || []).filter(m => m.highlightId !== highlightId);

    const updatedPage = {
      ...page,
      highlights: updatedHighlights,
      memos: updatedMemos,
      updatedAt: new Date().toISOString(),
    };

    setPage(updatedPage);
    updatePageInStore(updatedPage);

    // Re-render without deleted highlight
    const contentWithLinks = convertWikiLinksToMarkdown(page.content, pages);
    let html = await markdownService.toHtml(contentWithLinks);
    html = await resolveImagesInHtml(html, page.path);
    html = applyHighlightsToHtml(html, updatedHighlights);
    setHtmlContent(html);

    try {
      await pageService.updatePage(updatedPage);
    } catch (err) {
      console.error('Failed to delete highlight:', err);
      showToast('Failed to delete highlight', 'error');
    }

    setShowHoverMenu(false);
  }, [page, pages, updatePageInStore, showToast]);

  // Memo CRUD operations
  const handleCreateMemo = useCallback(async () => {
    if (!page) return;

    const newMemoId = crypto.randomUUID();
    const newMemo: Memo = {
      id: newMemoId,
      type: 'independent',
      note: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      order: (page.memos || []).length,
    };

    const updatedMemos = [...(page.memos || []), newMemo];
    const updatedPage = {
      ...page,
      memos: updatedMemos,
      updatedAt: new Date().toISOString(),
    };

    setPage(updatedPage);
    updatePageInStore(updatedPage);
    setLastCreatedMemoId(newMemoId);

    try {
      await pageService.updatePage(updatedPage);
    } catch (err) {
      console.error('Failed to save memo:', err);
      showToast('Failed to save memo', 'error');
    }
  }, [page, updatePageInStore, showToast]);

  const handleUpdateMemo = useCallback(async (memoId: string, note: string) => {
    if (!page) return;

    const updatedMemos = (page.memos || []).map(m =>
      m.id === memoId ? { ...m, note, updatedAt: new Date().toISOString() } : m
    );

    const updatedPage = {
      ...page,
      memos: updatedMemos,
      updatedAt: new Date().toISOString(),
    };

    setPage(updatedPage);
    updatePageInStore(updatedPage);

    try {
      await pageService.updatePage(updatedPage);
    } catch (err) {
      console.error('Failed to update memo:', err);
      showToast('Failed to update memo', 'error');
    }
  }, [page, updatePageInStore, showToast]);

  const handleDeleteMemo = useCallback(async (memoId: string) => {
    if (!page) return;

    const updatedMemos = (page.memos || []).filter(m => m.id !== memoId);

    const updatedPage = {
      ...page,
      memos: updatedMemos,
      updatedAt: new Date().toISOString(),
    };

    setPage(updatedPage);
    updatePageInStore(updatedPage);

    try {
      await pageService.updatePage(updatedPage);
    } catch (err) {
      console.error('Failed to delete memo:', err);
      showToast('Failed to delete memo', 'error');
    }
  }, [page, updatePageInStore, showToast]);

  const handleScrollToHighlight = useCallback((highlightId: string) => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    const mark = contentEl.querySelector(`mark[data-highlight-id="${highlightId}"]`);
    if (mark) {
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Flash animation
      mark.classList.add('highlight-flash');
      setTimeout(() => mark.classList.remove('highlight-flash'), 1000);
    }
  }, []);

  const applyHighlightsToHtml = (html: string, highlights: Highlight[]): string => {
    if (!highlights || highlights.length === 0 || !highlightsVisible) return html;

    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Sort highlights by offset (reverse order to avoid offset shifting)
    const sorted = [...highlights].sort((a, b) => b.startOffset - a.startOffset);

    sorted.forEach(h => {
      const walker = document.createTreeWalker(
        tempDiv,
        NodeFilter.SHOW_TEXT,
        null
      );

      let textNode;
      let currentOffset = 0;
      const nodesToProcess: Array<{ node: Node; start: number; end: number }> = [];

      // First pass: collect all text nodes that overlap with this highlight
      while (textNode = walker.nextNode()) {
        const textContent = textNode.textContent || '';
        const nodeStart = currentOffset;
        const nodeEnd = currentOffset + textContent.length;

        // Check if this text node overlaps with the highlight range
        if (nodeStart < h.endOffset && nodeEnd > h.startOffset) {
          nodesToProcess.push({ node: textNode, start: nodeStart, end: nodeEnd });
        }

        currentOffset = nodeEnd;
      }

      // Second pass: apply highlights to collected nodes
      nodesToProcess.forEach(({ node, start: nodeStart, end: _nodeEnd }) => {
        const textContent = node.textContent || '';

        // Calculate which part of this text node should be highlighted
        const highlightStart = Math.max(0, h.startOffset - nodeStart);
        const highlightEnd = Math.min(textContent.length, h.endOffset - nodeStart);

        const before = textContent.substring(0, highlightStart);
        const highlighted = textContent.substring(highlightStart, highlightEnd);
        const after = textContent.substring(highlightEnd);

        // Skip if highlighted portion is only whitespace
        if (highlighted.trim().length === 0) {
          return;
        }

        const mark = document.createElement('mark');
        mark.className = `highlight highlight-${h.style}`;
        // Apply dark mode adjusted colors
        mark.style.backgroundColor = h.style === 'highlight' ? getHighlightColor(h.color) : 'transparent';
        mark.style.borderBottom = h.style === 'underline' ? `3px solid ${getUnderlineColor(h.color)}` : 'none';
        mark.setAttribute('data-highlight-id', h.id);
        mark.textContent = highlighted;

        const fragment = document.createDocumentFragment();
        if (before) fragment.appendChild(document.createTextNode(before));
        fragment.appendChild(mark);
        if (after) fragment.appendChild(document.createTextNode(after));

        node.parentNode?.replaceChild(fragment, node);
      });
    });

    return tempDiv.innerHTML;
  };

  const handleCopyLink = async () => {
    if (!page) return;

    // Use ID-based link format: [[page-id|Page Title]]
    // This is safe from file name changes since ID never changes
    const linkText = `[[${page.id}|${page.title}]]`;

    try {
      await navigator.clipboard.writeText(linkText);
      // Show a temporary toast/notification
      const btn = document.querySelector('.copy-link-btn');
      if (btn) {
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to copy link:', error);
      alert('Failed to copy link to clipboard');
    }
  };

  const handleEditorSave = async (updatedPage: Page) => {
    setPage(updatedPage);
    setEditing(false);
    // Reload the page to ensure mermaid diagrams render correctly
    await loadPage(updatedPage.id);
  };

  // Keyboard shortcuts for edit mode and find
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc to exit immerse mode
      if (e.key === 'Escape' && isImmerseMode) {
        e.preventDefault();
        setIsImmerseMode(false);
        showToast('Immerse mode deactivated', 'info');
        return;
      }

      // Cmd+Shift+I for immerse mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'i' && !editing) {
        e.preventDefault();
        setIsImmerseMode(!isImmerseMode);
        showToast(isImmerseMode ? 'Immerse mode deactivated' : 'Immerse mode activated', 'info');
        return;
      }

      // Don't process other shortcuts in immerse mode
      if (isImmerseMode) return;

      // Cmd+F for find
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && !editing) {
        e.preventDefault();
        setShowFindBar(prev => !prev);
        return;
      }

      // Cmd+M for memo mode toggle
      if ((e.metaKey || e.ctrlKey) && e.key === 'm' && !editing) {
        e.preventDefault();
        setMemoMode(prev => !prev);
        return;
      }

      // Prevent Cmd+S when not editing
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && !editing) {
        e.preventDefault();
        return;
      }

      // Cmd+E or just E key to enter edit mode (when not in an input)
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (!editing && !isInputField) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
          e.preventDefault();
          setEditing(true);
        } else if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          setEditing(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editing, memoMode, isImmerseMode, setIsImmerseMode, showToast]);

  // Track scroll position to show/hide scroll to top button
  useEffect(() => {
    const handleScroll = () => {
      // Show button when scrolled down more than 300px
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close page menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pageMenuRef.current && !pageMenuRef.current.contains(e.target as Node)) {
        setShowPageMenu(false);
      }
    };

    if (showPageMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPageMenu]);

  // Track mouse position for palette positioning
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Handle text selection for highlighting
  useEffect(() => {
    const handleMouseUp = () => {
      // Small delay to allow selection to complete
      setTimeout(handleTextSelection, 50);
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [handleTextSelection]);

  // Attach hover handlers to highlight marks
  useEffect(() => {
    const container = contentRef.current;
    if (!container || editing || !highlightsVisible) return;

    const marks = container.querySelectorAll<HTMLElement>('mark.highlight[data-highlight-id]');
    const handlers: Array<{ enter: (e: MouseEvent) => void; leave: (e: MouseEvent) => void }> = [];

    marks.forEach((mark) => {
      const handleMouseEnter = (_e: MouseEvent) => {
        // Clear any pending close timeout
        if (closeMenuTimeoutRef.current) {
          clearTimeout(closeMenuTimeoutRef.current);
          closeMenuTimeoutRef.current = null;
        }

        const highlightId = mark.getAttribute('data-highlight-id');
        if (!highlightId) return;

        // Only reposition if this is a different highlight
        // This prevents menu from jumping when hovering over different parts of a multi-line highlight
        const isDifferentHighlight = hoveredHighlightId !== highlightId;

        if (isDifferentHighlight) {
          // For multi-line highlights, position based on the hovered mark element
          // This ensures the menu appears close to the actual highlighted text
          const rect = mark.getBoundingClientRect();

          setHoverMenuPosition({
            top: rect.top + window.scrollY - 45, // 45px above the hovered line
            left: mousePositionRef.current.x - 100, // Horizontally centered on cursor
          });
        }

        setHoveredHighlightId(highlightId);
        setShowHoverMenu(true);
      };

      const handleMouseLeave = (_e: MouseEvent) => {
        // Delay closing to allow mouse to move to menu
        closeMenuTimeoutRef.current = setTimeout(() => {
          if (!isMouseOverMenuRef.current) {
            setShowHoverMenu(false);
            setHoveredHighlightId(null);
          }
        }, 100);
      };

      mark.addEventListener('mouseenter', handleMouseEnter);
      mark.addEventListener('mouseleave', handleMouseLeave);
      handlers.push({ enter: handleMouseEnter, leave: handleMouseLeave });
    });

    return () => {
      marks.forEach((mark, index) => {
        mark.removeEventListener('mouseenter', handlers[index].enter);
        mark.removeEventListener('mouseleave', handlers[index].leave);
      });
      // Clear timeout on cleanup
      if (closeMenuTimeoutRef.current) {
        clearTimeout(closeMenuTimeoutRef.current);
      }
    };
  }, [htmlContent, editing, highlightsVisible]);

  // Listen for theme changes to re-render highlights with adjusted colors
  useEffect(() => {
    const handleThemeChange = () => {
      setThemeVersion(v => v + 1);
    };

    // Listen for data-theme attribute changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          handleThemeChange();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    // Listen for system color scheme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const mediaQueryListener = () => handleThemeChange();
    mediaQuery.addEventListener('change', mediaQueryListener);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', mediaQueryListener);
    };
  }, []);

  // Re-render when highlights visibility or theme changes
  useEffect(() => {
    if (!page) return;

    const reRender = async () => {
      const contentWithLinks = convertWikiLinksToMarkdown(page.content, pages);
      let html = await markdownService.toHtml(contentWithLinks);
      html = await resolveImagesInHtml(html, page.path);
      html = applyHighlightsToHtml(html, page.highlights || []);
      setHtmlContent(html);
    };

    reRender();
  }, [highlightsVisible, page, pages, themeVersion]);

  // Memo panel resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    isResizingRef.current = true;
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = memoPanelWidth;
    e.preventDefault();
  }, [memoPanelWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;

      const deltaX = resizeStartXRef.current - e.clientX;
      const newWidth = resizeStartWidthRef.current + deltaX;

      // Get viewport width to calculate max width (50%)
      const maxWidth = window.innerWidth * 0.5;
      const minWidth = 500;

      // Constrain width between min and max
      const constrainedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
      setMemoPanelWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
    };

    if (memoMode) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [memoMode]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  if (loading) {
    return (
      <div className="page-view">
        <div className="loading">Loading page...</div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="page-view">
        <div className="error">Page not found</div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="page-view">
        <PageEditor
          page={page}
          onSave={handleEditorSave}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <>
      <div className={`page-view-container ${showTerminal ? 'with-terminal' : ''}`}>
        <div className={`page-view ${isImmerseMode ? 'immerse-mode' : ''}`}>
        {!isImmerseMode && (
        <div className="page-header">
        <div className="page-header-top">
          <button className="btn-icon" onClick={() => navigate(-1)} title="Go back">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1>{page.title}</h1>
          <div className="page-actions">
            <button className="btn btn-secondary" onClick={() => setEditing(true)}>
              <span className="material-symbols-outlined">edit</span>
              Edit
            </button>
            <div className="page-menu-container" ref={pageMenuRef}>
              <button
                className="btn btn-secondary btn-icon"
                onClick={() => setShowPageMenu(!showPageMenu)}
                title="More options"
              >
                <span className="material-symbols-outlined">more_vert</span>
              </button>
              {showPageMenu && (
                <div className="page-menu-dropdown">
                  <button
                    className="page-menu-item"
                    onClick={() => {
                      handleCopyLink();
                      setShowPageMenu(false);
                    }}
                  >
                    <span className="material-symbols-outlined">link</span>
                    Copy Link
                  </button>
                  <button
                    className="page-menu-item"
                    onClick={() => {
                      setMemoMode(!memoMode);
                      setShowPageMenu(false);
                    }}
                  >
                    <span className="material-symbols-outlined">
                      {memoMode ? 'close' : 'sticky_note_2'}
                    </span>
                    {memoMode ? 'Exit Memo Mode' : 'Memo Mode'}
                  </button>
                  <button
                    className="page-menu-item"
                    onClick={() => {
                      setHighlightsVisible(!highlightsVisible);
                      setShowPageMenu(false);
                    }}
                  >
                    <span className="material-symbols-outlined">
                      {highlightsVisible ? 'visibility_off' : 'visibility'}
                    </span>
                    {highlightsVisible ? 'Hide Highlights' : 'Show Highlights'}
                  </button>
                  <button
                    className="page-menu-item"
                    onClick={() => {
                      setShowTerminal(!showTerminal);
                      setShowPageMenu(false);
                    }}
                  >
                    <span className="material-symbols-outlined">terminal</span>
                    {showTerminal ? 'Hide Terminal' : 'Show Terminal'}
                  </button>
                  <div className="page-menu-divider"></div>
                  <button
                    className="page-menu-item page-menu-item-danger"
                    onClick={() => {
                      setShowPageMenu(false);
                      handleDelete();
                    }}
                  >
                    <span className="material-symbols-outlined">delete</span>
                    Delete Page
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="page-meta">
          {page.kanbanColumn && (
            <div
              className="page-column-badge"
              style={columnColors[page.kanbanColumn.toLowerCase()]
                ? { backgroundColor: columnColors[page.kanbanColumn.toLowerCase()] }
                : undefined}
            >
              {page.kanbanColumn}
            </div>
          )}
          {page.dueDate && (
            <div className="due-date">
              Due: {new Date(page.dueDate).toLocaleDateString()}
            </div>
          )}
          <div className="page-dates">
            <span>Created: {new Date(page.createdAt).toLocaleDateString()}</span>
            <span>Updated: {new Date(page.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
        )}

      <div className={`page-content-layout ${memoMode ? 'memo-mode-active' : ''}`}>
        <div className="document-view">
          {showFindBar && (
            <FindBar
              content={page.content}
              contentRef={contentRef}
              onClose={() => setShowFindBar(false)}
            />
          )}
          <div
            ref={contentRef}
            className="markdown-content"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />

          {page.children && page.children.length > 0 && (
            <div className="sub-pages">
              <h2>Sub-pages</h2>
              <div className="sub-pages-list">
                {page.children.map(child => (
                  <Link key={child.id} to={`/page/${child.id}`} className="sub-page-card">
                    <h3>{child.title}</h3>
                    {child.tags.length > 0 && (
                      <div className="tags">
                        {child.tags.map(tag => (
                          <span key={tag} className="tag-small">{tag}</span>
                        ))}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {memoMode && (
          <>
            <div
              className="memo-resize-handle"
              onMouseDown={handleResizeStart}
            />
            <div
              className="memo-panel-wrapper"
              style={{ width: `${memoPanelWidth}px` }}
            >
              <MemoPanel
                memos={page.memos || []}
                onCreateMemo={handleCreateMemo}
                onUpdateMemo={handleUpdateMemo}
                onDeleteMemo={handleDeleteMemo}
                onScrollToHighlight={handleScrollToHighlight}
                lastCreatedMemoId={lastCreatedMemoId}
              />
            </div>
          </>
        )}
      </div>
      </div>
      {showTerminal && <Terminal workspacePath={config.workspacePath} />}
      </div>

      {/* Mermaid diagram zoom modal */}
      {zoomedDiagram && (
        <div
          className="diagram-zoom-modal"
          onClick={() => setZoomedDiagram(null)}
        >
          <div
            className="diagram-zoom-content"
            dangerouslySetInnerHTML={{ __html: zoomedDiagram }}
          />
        </div>
      )}

      {/* Scroll to top button */}
      {showScrollTop && !editing && !isImmerseMode && (
        <button
          className="scroll-to-top"
          onClick={scrollToTop}
          title="Scroll to top"
        >
          <span className="material-symbols-outlined">arrow_upward</span>
        </button>
      )}

      {/* Highlight palette */}
      {showHighlightPalette && (
        <HighlightPalette
          position={palettePosition}
          colors={highlightColors}
          onHighlight={applyHighlight}
          onClose={() => setShowHighlightPalette(false)}
        />
      )}

      {/* Highlight hover menu */}
      {showHoverMenu && hoveredHighlightId && page && (
        <div
          onMouseEnter={() => {
            isMouseOverMenuRef.current = true;
            if (closeMenuTimeoutRef.current) {
              clearTimeout(closeMenuTimeoutRef.current);
              closeMenuTimeoutRef.current = null;
            }
          }}
          onMouseLeave={() => {
            isMouseOverMenuRef.current = false;
            closeMenuTimeoutRef.current = setTimeout(() => {
              setShowHoverMenu(false);
              setHoveredHighlightId(null);
            }, 100);
          }}
        >
          <HighlightHoverMenu
            highlightId={hoveredHighlightId}
            currentColor={page.highlights?.find(h => h.id === hoveredHighlightId)?.color || highlightColors[0]}
            colors={highlightColors}
            position={hoverMenuPosition}
            onChangeColor={handleChangeHighlightColor}
            onDelete={handleDeleteHighlight}
            onClose={() => {
              setShowHoverMenu(false);
              setHoveredHighlightId(null);
            }}
          />
        </div>
      )}

      {/* Delete confirmation modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Page"
        message={`Are you sure you want to delete "${page?.title}"? This will also delete all sub-pages. This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        danger={true}
      />
    </>
  );
}
