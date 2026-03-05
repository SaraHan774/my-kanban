import { useEffect, useRef, useState, RefObject } from 'react';
import { Editor } from '@tiptap/core';

interface HoveredHighlight {
  id: string;
  color: string;
  rect: DOMRect;
}

interface UseHighlightHoverTooltipOptions {
  editor: Editor | null;
  containerRef: RefObject<HTMLDivElement | null>;
  readOnly: boolean;
}

export function useHighlightHoverTooltip({
  editor,
  containerRef,
  readOnly,
}: UseHighlightHoverTooltipOptions) {
  const [hoveredHighlight, setHoveredHighlight] = useState<HoveredHighlight | null>(null);
  const isMouseOverTooltipRef = useRef(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Attach mouseenter/mouseleave handlers to highlight mark elements
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !editor || readOnly) return;

    let marks: NodeListOf<HTMLElement> | null = null;
    let handlers: Array<{ enter: () => void; leave: () => void }> = [];

    const attachHandlers = () => {
      marks = container.querySelectorAll<HTMLElement>('mark.highlight-mark[data-highlight-id]');
      handlers = [];

      marks.forEach((mark) => {
        const handleMouseEnter = () => {
          if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
          }
          const highlightId = mark.getAttribute('data-highlight-id');
          const color = mark.getAttribute('data-highlight-color') || mark.style.backgroundColor || '';
          if (!highlightId) return;
          const rect = mark.getBoundingClientRect();
          setHoveredHighlight({ id: highlightId, color, rect });
        };

        const handleMouseLeave = () => {
          closeTimeoutRef.current = setTimeout(() => {
            if (!isMouseOverTooltipRef.current) {
              setHoveredHighlight(null);
            }
          }, 150);
        };

        mark.addEventListener('mouseenter', handleMouseEnter);
        mark.addEventListener('mouseleave', handleMouseLeave);
        handlers.push({ enter: handleMouseEnter, leave: handleMouseLeave });
      });
    };

    attachHandlers();

    // Re-attach when DOM content changes
    const observer = new MutationObserver(() => {
      if (marks && handlers.length > 0) {
        marks.forEach((mark, i) => {
          if (handlers[i]) {
            mark.removeEventListener('mouseenter', handlers[i].enter);
            mark.removeEventListener('mouseleave', handlers[i].leave);
          }
        });
      }
      attachHandlers();
    });

    observer.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (marks && handlers.length > 0) {
        marks.forEach((mark, i) => {
          if (handlers[i]) {
            mark.removeEventListener('mouseenter', handlers[i].enter);
            mark.removeEventListener('mouseleave', handlers[i].leave);
          }
        });
      }
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [editor, readOnly, containerRef]);

  // Dismiss tooltip when text selection starts
  useEffect(() => {
    if (!editor) return;
    const handleSelectionUpdate = () => {
      const { from, to } = editor.state.selection;
      if (from !== to) setHoveredHighlight(null);
    };
    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => { editor.off('selectionUpdate', handleSelectionUpdate); };
  }, [editor]);

  /** Call from tooltip's onMouseEnter */
  const onTooltipMouseEnter = () => {
    isMouseOverTooltipRef.current = true;
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  /** Call from tooltip's onMouseLeave */
  const onTooltipMouseLeave = () => {
    isMouseOverTooltipRef.current = false;
    closeTimeoutRef.current = setTimeout(() => {
      setHoveredHighlight(null);
    }, 100);
  };

  const dismiss = () => setHoveredHighlight(null);

  return {
    hoveredHighlight,
    onTooltipMouseEnter,
    onTooltipMouseLeave,
    dismiss,
  };
}
