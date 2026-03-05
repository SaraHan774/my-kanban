import { useState, useRef, useMemo, useCallback } from 'react';
import { Page } from '@/types';

interface PageMetadataProps {
  page: Page;
  allPages: Page[];
  columnColors: Record<string, string>;
  onTitleChange: (title: string) => void;
  onColumnChange: (column: string) => void;
  onTagAdd: (tag: string) => void;
  onTagRemove: (tag: string) => void;
  onDueDateChange: (date: string) => void;
  getColumnColor: (column: string) => string;
}

export function PageMetadata({
  page,
  allPages,
  onTitleChange,
  onColumnChange,
  onTagAdd,
  onTagRemove,
  onDueDateChange,
  getColumnColor,
}: PageMetadataProps) {
  const [editTitle, setEditTitle] = useState(page.title);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [newColumnInput, setNewColumnInput] = useState('');
  const columnDropdownRef = useRef<HTMLDivElement>(null);

  const existingColumns = useMemo(
    () => Array.from(new Set(allPages.map(p => p.kanbanColumn).filter(Boolean) as string[])),
    [allPages]
  );

  const allTags = useMemo(() => Array.from(new Set(allPages.flatMap(p => p.tags))), [allPages]);
  const filteredSuggestions = useMemo(
    () => allTags.filter(
      tag => !page.tags.includes(tag) && tag.toLowerCase().includes(tagInput.toLowerCase())
    ).slice(0, 8),
    [allTags, page.tags, tagInput]
  );

  const handleTitleBlur = useCallback(() => {
    if (editTitle !== page.title) {
      onTitleChange(editTitle);
    }
  }, [editTitle, page.title, onTitleChange]);

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      onTagAdd(tagInput.trim());
      setTagInput('');
      setShowTagSuggestions(false);
    } else if (e.key === 'Escape') {
      setTagInput('');
      setShowTagSuggestions(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="editor-meta">
      {/* Title */}
      <div className="editor-field">
        <input
          type="text"
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onBlur={handleTitleBlur}
          className="editor-title-input"
          placeholder="Untitled"
        />
      </div>

      <div className="editor-props">
        {/* Column */}
        <div className="editor-prop-row">
          <span className="editor-prop-label">
            <span className="material-symbols-outlined">view_column</span>
            Column
          </span>
          <div className="editor-prop-value">
            <div className="column-selector" ref={columnDropdownRef}>
              <div
                className="column-selector-display"
                onClick={() => setShowColumnDropdown(!showColumnDropdown)}
              >
                {page.kanbanColumn ? (
                  <span
                    className="selected-column-chip"
                    style={{ backgroundColor: getColumnColor(page.kanbanColumn), color: 'white' }}
                  >
                    {page.kanbanColumn}
                    <button
                      type="button"
                      className="chip-remove"
                      onClick={(e) => { e.stopPropagation(); onColumnChange(''); }}
                    >✕</button>
                  </span>
                ) : (
                  <span className="column-placeholder">Empty</span>
                )}
              </div>
              {showColumnDropdown && (
                <div className="column-dropdown">
                  {existingColumns.length > 0 && (
                    <div className="column-chips">
                      {existingColumns.map(col => (
                        <button
                          key={col}
                          type="button"
                          className={`column-chip ${page.kanbanColumn === col ? 'active' : ''}`}
                          style={getColumnColor(col)
                            ? page.kanbanColumn === col
                              ? { backgroundColor: getColumnColor(col), color: 'white', borderColor: 'transparent' }
                              : { borderColor: getColumnColor(col), color: getColumnColor(col) }
                            : undefined}
                          onClick={() => { onColumnChange(col); setShowColumnDropdown(false); }}
                        >
                          {col}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="column-new-input">
                    <input
                      type="text"
                      value={newColumnInput}
                      onChange={e => setNewColumnInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newColumnInput.trim()) {
                          onColumnChange(newColumnInput.trim());
                          setNewColumnInput('');
                          setShowColumnDropdown(false);
                        }
                      }}
                      placeholder="New column..."
                    />
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        if (newColumnInput.trim()) {
                          onColumnChange(newColumnInput.trim());
                          setNewColumnInput('');
                          setShowColumnDropdown(false);
                        }
                      }}
                      disabled={!newColumnInput.trim()}
                    >Add</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="editor-prop-row">
          <span className="editor-prop-label">
            <span className="material-symbols-outlined">sell</span>
            Tags
          </span>
          <div className="editor-prop-value">
            <div className="page-tags-section">
              {page.tags.map(tag => (
                <span key={tag} className="page-tag">
                  {tag}
                  <button className="tag-remove-btn" onClick={() => onTagRemove(tag)}>×</button>
                </span>
              ))}
              <div className="tag-input-wrapper">
                <input
                  className="tag-inline-input"
                  value={tagInput}
                  onChange={e => { setTagInput(e.target.value); setShowTagSuggestions(true); }}
                  onKeyDown={handleTagKeyDown}
                  onFocus={() => setShowTagSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
                  placeholder={page.tags.length === 0 ? "Add tag..." : "+"}
                />
                {showTagSuggestions && tagInput && filteredSuggestions.length > 0 && (
                  <div className="tag-suggestions">
                    {filteredSuggestions.map(tag => (
                      <button key={tag} onMouseDown={() => { onTagAdd(tag); setTagInput(''); setShowTagSuggestions(false); }}>{tag}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Due Date */}
        <div className="editor-prop-row">
          <span className="editor-prop-label">
            <span className="material-symbols-outlined">calendar_today</span>
            Due Date
          </span>
          <div className="editor-prop-value">
            <input
              type="date"
              value={page.dueDate ? page.dueDate.slice(0, 10) : ''}
              onChange={e => onDueDateChange(e.target.value)}
            />
          </div>
        </div>

        {/* Created */}
        <div className="editor-prop-row">
          <span className="editor-prop-label">
            <span className="material-symbols-outlined">schedule</span>
            Created
          </span>
          <div className="editor-prop-value">
            <span className="editor-prop-static">{new Date(page.createdAt).toLocaleString()}</span>
          </div>
        </div>

        {/* Updated */}
        <div className="editor-prop-row">
          <span className="editor-prop-label">
            <span className="material-symbols-outlined">update</span>
            Updated
          </span>
          <div className="editor-prop-value">
            <span className="editor-prop-static">{new Date(page.updatedAt).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
