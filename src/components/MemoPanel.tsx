import { Memo } from '@/types';
import { MemoCard } from './MemoCard';
import './MemoPanel.css';

interface MemoPanelProps {
  memos: Memo[];
  onCreateMemo: () => void;
  onUpdateMemo: (memoId: string, note: string) => void;
  onDeleteMemo: (memoId: string) => void;
  onScrollToHighlight?: (highlightId: string) => void;
}

export function MemoPanel({
  memos,
  onCreateMemo,
  onUpdateMemo,
  onDeleteMemo,
  onScrollToHighlight
}: MemoPanelProps) {
  // Sort memos: pinned first (if we add pinning later), then by order
  const sortedMemos = [...memos].sort((a, b) => a.order - b.order);

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
          title="Create new memo"
        >
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>

      {/* Memos List */}
      <div className="memo-panel-content">
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
              <MemoCard
                key={memo.id}
                memo={memo}
                onUpdate={onUpdateMemo}
                onDelete={onDeleteMemo}
                onScrollToHighlight={onScrollToHighlight}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
