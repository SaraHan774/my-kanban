import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { pageService } from '@/services';
import './CreatePageModal.css';

interface CreatePageModalProps {
  onClose: () => void;
  parentPath?: string;
}

export function CreatePageModal({ onClose, parentPath }: CreatePageModalProps) {
  const navigate = useNavigate();
  const { addPage, pages, config } = useStore();
  const [title, setTitle] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}`;
  });
  const [selectedColumn, setSelectedColumn] = useState('');
  const [newColumnInput, setNewColumnInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const effectiveParentPath = parentPath || config.workspacePath;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const page = await pageService.createPage(effectiveParentPath, title.trim(), {
        viewType: 'document',
        kanbanColumn: selectedColumn || undefined,
        tags: selectedColumn ? [selectedColumn] : [],
      });

      addPage(page);
      onClose();
      navigate(`/page/${page.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create page');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Page</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="page-title">Title</label>
            <input
              id="page-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Page title"
              autoFocus
            />
          </div>

          <div className="form-group">
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
                  <span className="column-placeholder">Select or create a column...</span>
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
                      placeholder="New column name..."
                      autoFocus
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
            <span className="form-hint">
              Select an existing column or create a new one. This determines where the page appears on the board.
            </span>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create Page'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
