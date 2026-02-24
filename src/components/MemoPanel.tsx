import { useEffect, useRef } from 'react';
import { Memo } from '@/types';
import { MemoCard } from './MemoCard';
import './MemoPanel.css';

interface MemoPanelProps {
  memos: Memo[];
  onCreateMemo: () => void;
  onUpdateMemo: (memoId: string, note: string) => void;
  onDeleteMemo: (memoId: string) => void;
  onScrollToHighlight?: (highlightId: string) => void;
  lastCreatedMemoId?: string | null;
}

export function MemoPanel({
  memos,
  onCreateMemo,
  onUpdateMemo,
  onDeleteMemo,
  onScrollToHighlight,
  lastCreatedMemoId
}: MemoPanelProps) {
  // Sort memos: pinned first (if we add pinning later), then by order
  const sortedMemos = [...memos].sort((a, b) => a.order - b.order);
  const memoRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const panelContentRef = useRef<HTMLDivElement>(null);

  // Scroll to newly created memo within panel only (no page scroll)
  useEffect(() => {
    if (lastCreatedMemoId && panelContentRef.current) {
      const memoElement = memoRefs.current.get(lastCreatedMemoId);
      if (memoElement) {
        // Calculate position relative to panel content
        const panelRect = panelContentRef.current.getBoundingClientRect();
        const memoRect = memoElement.getBoundingClientRect();
        const scrollOffset = memoRect.top - panelRect.top + panelContentRef.current.scrollTop;

        // Smooth scroll within panel only
        panelContentRef.current.scrollTo({
          top: scrollOffset,
          behavior: 'smooth'
        });
      }
    }
  }, [lastCreatedMemoId]);

  const setMemoRef = (id: string, element: HTMLDivElement | null) => {
    if (element) {
      memoRefs.current.set(id, element);
    } else {
      memoRefs.current.delete(id);
    }
  };

  return (
    <div className="memo-panel">
      {/* Header */}
      <div className="memo-panel-header">
        <h3 className="memo-panel-title">
          Memos
          {sortedMemos.length > 0 && (
            <span className="memo-count">{sortedMemos.length}</span>
          )}
        </h3>
        <button
          className="btn-add-memo"
          onClick={onCreateMemo}
          title="Create new memo (Cmd+Shift+M)"
        >
          <span className="material-symbols-outlined">add</span>
          New
        </button>
      </div>

      {/* Memos List */}
      <div className="memo-panel-content" ref={panelContentRef}>
        {sortedMemos.length === 0 ? (
          <div className="memo-panel-empty">
            <div className="memo-panel-empty-icon">📋</div>
            <div className="memo-panel-empty-text">No memos yet</div>
            <div className="memo-panel-empty-hint">
              Highlight text and create a memo
            </div>
          </div>
        ) : (
          <div className="memo-panel-list">
            {sortedMemos.map((memo) => (
              <div key={memo.id} ref={(el) => setMemoRef(memo.id, el)}>
                <MemoCard
                  memo={memo}
                  onUpdate={onUpdateMemo}
                  onDelete={onDeleteMemo}
                  onScrollToHighlight={onScrollToHighlight}
                  autoFocus={memo.id === lastCreatedMemoId}
                />
              </div>
            ))}
            {/* Bottom padding to allow last memo to scroll to top */}
            <div style={{ height: '60vh' }} />
          </div>
        )}
      </div>
    </div>
  );
}
