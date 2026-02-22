import { useState, useRef, useEffect } from 'react';
import { Memo } from '@/types';
import './MemoCard.css';

interface MemoCardProps {
  memo: Memo;
  onUpdate: (memoId: string, note: string) => void;
  onDelete: (memoId: string) => void;
  onScrollToHighlight?: (highlightId: string) => void;
}

export function MemoCard({ memo, onUpdate, onDelete, onScrollToHighlight }: MemoCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [noteText, setNoteText] = useState(memo.note);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [noteText, isEditing]);

  const handleSave = () => {
    onUpdate(memo.id, noteText);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setNoteText(memo.note);
    setIsEditing(false);
  };

  const handleHighlightClick = () => {
    if (memo.type === 'linked' && memo.highlightId && onScrollToHighlight) {
      onScrollToHighlight(memo.highlightId);
    }
  };

  return (
    <div className={`memo-card memo-card-${memo.type}`}>
      {/* Header */}
      <div className="memo-card-header">
        <span className="memo-card-type-badge">
          {memo.type === 'independent' ? 'Note' : 'Linked'}
        </span>
        <button
          className="memo-card-delete"
          onClick={() => onDelete(memo.id)}
          title="Delete memo"
        >
          ✕
        </button>
      </div>

      {/* Linked memo: show highlighted text */}
      {memo.type === 'linked' && memo.highlightText && (
        <div className="memo-card-highlight">
          <div
            className="memo-card-highlight-text"
            onClick={handleHighlightClick}
            style={{ borderLeftColor: memo.highlightColor }}
          >
            "{memo.highlightText}"
            {memo.highlightColor && (
              <span
                className="memo-card-highlight-color"
                style={{ backgroundColor: memo.highlightColor }}
              />
            )}
          </div>
        </div>
      )}

      {/* Notes section */}
      <div className="memo-card-notes">
        {isEditing ? (
          <div className="memo-card-edit">
            <textarea
              ref={textareaRef}
              className="memo-card-textarea"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add your notes..."
              autoFocus
            />
            <div className="memo-card-edit-actions">
              <button className="btn btn-sm btn-primary" onClick={handleSave}>
                Save
              </button>
              <button className="btn btn-sm btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            className="memo-card-note-display"
            onClick={() => setIsEditing(true)}
          >
            {memo.note || (
              <span className="memo-card-note-placeholder">
                Add notes...
              </span>
            )}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="memo-card-meta">
        {new Date(memo.createdAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
    </div>
  );
}
