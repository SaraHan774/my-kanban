import { useState, useCallback, useEffect, useRef } from 'react';
import { Page } from '@/types';
import { pageService, markdownService } from '@/services';
import { useStore } from '@/store/useStore';
import './PageEditor.css';

interface PageEditorProps {
  page: Page;
  onSave: (updatedPage: Page) => void;
  onCancel: () => void;
}

export function PageEditor({ page, onSave, onCancel }: PageEditorProps) {
  const { updatePageInStore, pages } = useStore();
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content);
  const [tags, setTags] = useState(page.tags.join(', '));
  const [dueDate, setDueDate] = useState(page.dueDate ? page.dueDate.slice(0, 10) : '');
  const [selectedColumn, setSelectedColumn] = useState(page.kanbanColumn || '');
  const [newColumnInput, setNewColumnInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Derive existing columns from all pages' kanbanColumn values (case-insensitive dedup)
  const existingColumns = Array.from(
    pages.map(p => p.kanbanColumn).filter(Boolean).reduce((map, col) => {
      const key = (col as string).toLowerCase();
      if (!map.has(key)) map.set(key, col as string);
      return map;
    }, new Map<string, string>()).values()
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePreview = useCallback(async () => {
    if (!preview) {
      const html = await markdownService.toHtml(content);
      setPreviewHtml(html);
    }
    setPreview(!preview);
  }, [preview, content]);

  const handleAddNewColumn = () => {
    const trimmed = newColumnInput.trim();
    if (!trimmed) return;
    setSelectedColumn(trimmed);
    setNewColumnInput('');
    setShowDropdown(false);
  };

  const handleNewColumnKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNewColumn();
    }
  };

  // Keyboard shortcut: Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [title, content, tags, dueDate, selectedColumn]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      const updatedPage: Page = {
        ...page,
        title: title.trim() || page.title,
        content,
        tags: tagList,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        kanbanColumn: selectedColumn || undefined,
      };

      await pageService.updatePage(updatedPage);
      updatePageInStore(updatedPage);
      onSave(updatedPage);
    } catch (error) {
      console.error('Failed to save page:', error);
      alert('Failed to save page. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-editor">
      <div className="editor-toolbar">
        <div className="editor-toolbar-left">
          <button
            className={`toolbar-btn ${!preview ? 'active' : ''}`}
            onClick={() => setPreview(false)}
          >
            Edit
          </button>
          <button
            className={`toolbar-btn ${preview ? 'active' : ''}`}
            onClick={handlePreview}
          >
            Preview
          </button>
        </div>
        <div className="editor-toolbar-right">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="editor-meta">
        <div className="editor-field">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="editor-title-input"
            placeholder="Untitled"
          />
        </div>
        <div className="editor-field-row">
          <div className="editor-field">
            <label>Column</label>
            <div className="column-selector" ref={dropdownRef}>
              <div
                className="column-selector-display"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                {selectedColumn ? (
                  <span className="selected-column-chip">
                    {selectedColumn}
                    <button
                      type="button"
                      className="chip-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedColumn('');
                      }}
                    >
                      ✕
                    </button>
                  </span>
                ) : (
                  <span className="column-placeholder">Column...</span>
                )}
              </div>

              {showDropdown && (
                <div className="column-dropdown">
                  {existingColumns.length > 0 && (
                    <div className="column-chips">
                      {existingColumns.map(col => (
                        <button
                          key={col}
                          type="button"
                          className={`column-chip ${selectedColumn === col ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedColumn(col);
                            setShowDropdown(false);
                          }}
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
                      onKeyDown={handleNewColumnKeyDown}
                      placeholder="New column..."
                    />
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={handleAddNewColumn}
                      disabled={!newColumnInput.trim()}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="editor-field">
            <label>Tags</label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="comma-separated"
            />
          </div>
          <div className="editor-field">
            <label>Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {preview ? (
        <div
          className="editor-preview markdown-content"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      ) : (
        <textarea
          className="editor-textarea"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Write your content in markdown..."
          spellCheck
        />
      )}
    </div>
  );
}
