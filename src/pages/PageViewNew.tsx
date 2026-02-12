import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { pageService, clearImageCache, saveImage } from '@/services';
import { Page } from '@/types';
import { ToastEditor } from '@/components/editor/ToastEditor';
import './PageView.css';

export function PageViewNew() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { pages, removePage, updatePageInStore, columnColors } = useStore();
  const [page, setPage] = useState<Page | null>(null);
  const [content, setContent] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [tags, setTags] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [newColumnInput, setNewColumnInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Clean up blob URLs on unmount or page change
  useEffect(() => {
    return () => {
      clearImageCache();
    };
  }, [pageId]);

  useEffect(() => {
    if (pageId) {
      loadPage(pageId);
    }
  }, [pageId]);

  // Retry when pages become available
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
        setContent(fullPage.content);
        setTitle(fullPage.title);
        setTags(fullPage.tags.join(', '));
        setDueDate(fullPage.dueDate ? fullPage.dueDate.slice(0, 10) : '');
        setSelectedColumn(fullPage.kanbanColumn || '');
      }
    } catch (error) {
      console.error('Failed to load page:', error);
    } finally {
      setLoading(false);
    }
  };

  // Manual save handler
  const handleSave = useCallback(async () => {
    if (!page) return;
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
        updatedAt: new Date().toISOString(),
      };

      await pageService.updatePage(updatedPage);
      updatePageInStore(updatedPage);
      setPage(updatedPage);

      // Show success toast
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error('Failed to save page:', error);
      alert('Failed to save page. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [page, title, content, tags, dueDate, selectedColumn, updatePageInStore]);

  // Derive existing columns
  const existingColumns = Array.from(
    pages.map(p => p.kanbanColumn).filter(Boolean).reduce((map, col) => {
      const key = (col as string).toLowerCase();
      if (!map.has(key)) map.set(key, col as string);
      return map;
    }, new Map<string, string>()).values()
  );

  const getColColor = (col: string) => columnColors[col.toLowerCase()];

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

  const handleDelete = async () => {
    if (!page) return;
    if (!window.confirm(`Delete "${page.title}"? This will also delete all sub-pages.`)) return;
    try {
      await pageService.deletePage(page.path);
      removePage(page.id);
      navigate('/');
    } catch (error) {
      console.error('Failed to delete page:', error);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  return (
    <>
      {showToast && (
        <div className="toast-notification">
          <span className="material-symbols-outlined">check_circle</span>
          <span>Saved successfully!</span>
        </div>
      )}
      <div className="page-view">
        <div className="page-header">
          <div className="page-header-top">
            <button className="btn-icon" onClick={() => navigate(-1)} title="Go back">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="page-title-input-wrapper">
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="page-title-input"
                placeholder="Untitled"
              />
            </div>
            <div className="page-actions">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
          <div className="page-meta-editor">
            <div className="editor-field">
              <label>Column</label>
              <div className="column-selector" ref={dropdownRef}>
                <div
                  className="column-selector-display"
                  onClick={() => setShowDropdown(!showDropdown)}
                >
                  {selectedColumn ? (
                    <span
                      className="selected-column-chip"
                      style={getColColor(selectedColumn) ? { backgroundColor: getColColor(selectedColumn) } : undefined}
                    >
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
                            style={getColColor(col)
                              ? selectedColumn === col
                                ? { backgroundColor: getColColor(col), color: 'white', borderColor: 'transparent' }
                                : { borderColor: getColColor(col), color: getColColor(col) }
                              : undefined}
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
            <div className="page-dates">
              <span>Created: {new Date(page.createdAt).toLocaleDateString()}</span>
              <span>Updated: {new Date(page.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="editor-content-wrapper">
          <ToastEditor
            key={page.id}
            content={content}
            onChange={setContent}
            onImageUpload={async (file) => {
              const relativePath = await saveImage(page.path, file);
              return relativePath;
            }}
          />
        </div>

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

      {/* Scroll to top button */}
      {showScrollTop && (
        <button
          className="scroll-to-top"
          onClick={scrollToTop}
          title="Scroll to top"
        >
          <span className="material-symbols-outlined">arrow_upward</span>
        </button>
      )}
    </>
  );
}
