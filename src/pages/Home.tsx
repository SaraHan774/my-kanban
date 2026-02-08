import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { fileSystemService, pageService, markdownService } from '@/services';
import { CreatePageModal } from '@/components/CreatePageModal';
import './Home.css';

const COLUMN_COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function Home() {
  const {
    hasFileSystemAccess, setHasFileSystemAccess, setSidebarOpen,
    pages, updatePageInStore,
  } = useStore();

  const [boardView, setBoardView] = useState<'kanban' | 'list'>('kanban');
  const [listSortField, setListSortField] = useState<'title' | 'createdAt' | 'dueDate'>('title');
  const [listSortDir, setListSortDir] = useState<'asc' | 'desc'>('asc');
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // 'idle' = checking, 'prompt' = needs user click, 'none' = no saved handle
  const [restoreState, setRestoreState] = useState<'idle' | 'prompt' | 'none'>('idle');

  // Check if a previously saved handle can be reconnected
  useEffect(() => {
    if (hasFileSystemAccess) return;

    const check = async () => {
      const result = await fileSystemService.tryRestore();
      if (result === 'granted') {
        setHasFileSystemAccess(true);
        setSidebarOpen(true);
      } else if (result === 'prompt') {
        setRestoreState('prompt');
      } else {
        setRestoreState('none');
      }
    };
    check();
  }, [hasFileSystemAccess]);

  const handleSelectFolder = async () => {
    try {
      await fileSystemService.requestDirectoryAccess();
      setHasFileSystemAccess(true);
      setSidebarOpen(true);
    } catch (error) {
      console.error('Failed to access file system:', error);
      alert('Failed to access folder. Please try again.');
    }
  };

  const handleReconnect = async () => {
    const granted = await fileSystemService.requestRestoredPermission();
    if (granted) {
      setHasFileSystemAccess(true);
      setSidebarOpen(true);
    } else {
      // Permission denied, fall back to full folder picker
      setRestoreState('none');
    }
  };

  if (!hasFileSystemAccess) {
    // Still checking IndexedDB
    if (restoreState === 'idle') {
      return (
        <div className="home">
          <div className="home-empty">
            <p>Loading workspace...</p>
          </div>
        </div>
      );
    }

    // Saved handle exists but needs user gesture to re-grant permission
    if (restoreState === 'prompt') {
      return (
        <div className="home">
          <div className="welcome-card">
            <h1>Welcome back</h1>
            <p className="welcome-text">
              Your workspace folder was disconnected after the page refresh.
              Click below to reconnect.
            </p>

            <button onClick={handleReconnect} className="btn btn-primary btn-large">
              Reconnect Workspace
            </button>

            <p className="help-text">
              Or{' '}
              <button className="link-btn" onClick={handleSelectFolder}>
                select a different folder
              </button>
            </p>
          </div>
        </div>
      );
    }

    // No saved handle — first-time welcome
    return (
      <div className="home">
        <div className="welcome-card">
          <h1>Welcome to My Kanban</h1>
          <p className="welcome-text">
            A local, file-based Kanban board with Notion-like pages.
            All your data is stored locally and can be tracked with git.
          </p>

          <div className="features">
            <div className="feature">
              <span className="feature-icon">📋</span>
              <h3>Kanban Board</h3>
              <p>Organize pages into columns with drag & drop</p>
            </div>
            <div className="feature">
              <span className="feature-icon">📝</span>
              <h3>Markdown Notes</h3>
              <p>Write notes with full markdown syntax support</p>
            </div>
            <div className="feature">
              <span className="feature-icon">🏷️</span>
              <h3>Tag = Column</h3>
              <p>Create tags that become kanban columns</p>
            </div>
          </div>

          <button onClick={handleSelectFolder} className="btn btn-primary btn-large">
            Select Workspace Folder
          </button>

          <p className="help-text">
            Choose a folder where your workspace will be stored.
            The app will create a &quot;workspace&quot; subfolder to organize your pages.
          </p>
        </div>
      </div>
    );
  }

  // Derive columns from all unique kanbanColumn values (case-insensitive dedup)
  const columns = Array.from(
    pages.map(p => p.kanbanColumn).filter(Boolean).reduce((map, col) => {
      const key = (col as string).toLowerCase();
      if (!map.has(key)) map.set(key, col as string);
      return map;
    }, new Map<string, string>()).values()
  );

  const hasUncategorized = pages.some(p => !p.kanbanColumn);

  // --- Drag & drop ---
  const handleDragStart = (cardId: string) => {
    setDraggedCardId(cardId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (columnTag: string) => {
    if (!draggedCardId) return;

    const card = pages.find(c => c.id === draggedCardId);
    if (!card || card.kanbanColumn?.toLowerCase() === columnTag.toLowerCase()) {
      setDraggedCardId(null);
      return;
    }

    const updatedCard = { ...card, kanbanColumn: columnTag };

    try {
      await pageService.updatePage(updatedCard);
      updatePageInStore(updatedCard);
    } catch (error) {
      console.error('Failed to move card:', error);
    }

    setDraggedCardId(null);
  };

  const handleDropUncategorized = async () => {
    if (!draggedCardId) return;

    const card = pages.find(c => c.id === draggedCardId);
    if (!card || !card.kanbanColumn) {
      setDraggedCardId(null);
      return;
    }

    const updatedCard = { ...card, kanbanColumn: undefined };

    try {
      await pageService.updatePage(updatedCard);
      updatePageInStore(updatedCard);
    } catch (error) {
      console.error('Failed to move card:', error);
    }

    setDraggedCardId(null);
  };

  // No pages and no columns yet
  if (pages.length === 0) {
    return (
      <div className="home">
        <div className="home-empty">
          <h2>No pages yet</h2>
          <p>Create your first page to get started.</p>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + New Page
          </button>
          {showCreateModal && (
            <CreatePageModal onClose={() => setShowCreateModal(false)} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="home-board">
      <div className="board-header">
        <div className="board-actions">
          <div className="board-view-toggle">
            <button
              className={`toggle-btn ${boardView === 'kanban' ? 'active' : ''}`}
              onClick={() => setBoardView('kanban')}
            >
              Board
            </button>
            <button
              className={`toggle-btn ${boardView === 'list' ? 'active' : ''}`}
              onClick={() => setBoardView('list')}
            >
              List
            </button>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + New Page
          </button>
        </div>
      </div>

      {boardView === 'kanban' ? (
        <div className="kanban-board">
          {columns.map((col, idx) => {
            const columnCards = pages.filter(p => p.kanbanColumn?.toLowerCase() === col.toLowerCase());
            const color = COLUMN_COLORS[idx % COLUMN_COLORS.length];
            return (
              <div
                key={col}
                className={`kanban-column ${draggedCardId ? 'droppable' : ''}`}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(col)}
              >
                <div className="column-header" style={{ borderTopColor: color }}>
                  <h3>{col}</h3>
                  <span className="card-count">{columnCards.length}</span>
                </div>
                <div className="column-content">
                  {columnCards.map(card => (
                    <div
                      key={card.id}
                      className={`kanban-card ${draggedCardId === card.id ? 'dragging' : ''}`}
                      draggable
                      onDragStart={() => handleDragStart(card.id)}
                      onDragEnd={() => setDraggedCardId(null)}
                    >
                      <Link to={`/page/${card.id}`} className="card-link">
                        <h4>{card.title}</h4>
                        {card.dueDate && (
                          <div className="card-due">
                            Due: {new Date(card.dueDate).toLocaleDateString()}
                          </div>
                        )}
                        <p className="card-excerpt">
                          {markdownService.getExcerpt(card.content)}
                        </p>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {hasUncategorized && (
            <div
              className={`kanban-column ${draggedCardId ? 'droppable' : ''}`}
              onDragOver={handleDragOver}
              onDrop={handleDropUncategorized}
            >
              <div className="column-header" style={{ borderTopColor: '#6b7280' }}>
                <h3>Uncategorized</h3>
                <span className="card-count">
                  {pages.filter(p => !p.kanbanColumn).length}
                </span>
              </div>
              <div className="column-content">
                {pages.filter(p => !p.kanbanColumn).map(card => (
                  <div
                    key={card.id}
                    className={`kanban-card ${draggedCardId === card.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(card.id)}
                    onDragEnd={() => setDraggedCardId(null)}
                  >
                    <Link to={`/page/${card.id}`} className="card-link">
                      <h4>{card.title}</h4>
                      {card.dueDate && (
                        <div className="card-due">
                          Due: {new Date(card.dueDate).toLocaleDateString()}
                        </div>
                      )}
                      <p className="card-excerpt">
                        {markdownService.getExcerpt(card.content)}
                      </p>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ===== LIST VIEW ===== */
        <div className="list-view">
          <div className="list-view-header">
            <span
              className={`list-col-header sortable ${listSortField === 'title' ? 'active' : ''}`}
              onClick={() => {
                if (listSortField === 'title') setListSortDir(d => d === 'asc' ? 'desc' : 'asc');
                else { setListSortField('title'); setListSortDir('asc'); }
              }}
            >
              Title {listSortField === 'title' ? (listSortDir === 'asc' ? '↑' : '↓') : ''}
            </span>
            <span className="list-col-header">Column</span>
            <span
              className={`list-col-header sortable ${listSortField === 'dueDate' ? 'active' : ''}`}
              onClick={() => {
                if (listSortField === 'dueDate') setListSortDir(d => d === 'asc' ? 'desc' : 'asc');
                else { setListSortField('dueDate'); setListSortDir('asc'); }
              }}
            >
              Due Date {listSortField === 'dueDate' ? (listSortDir === 'asc' ? '↑' : '↓') : ''}
            </span>
            <span
              className={`list-col-header sortable ${listSortField === 'createdAt' ? 'active' : ''}`}
              onClick={() => {
                if (listSortField === 'createdAt') setListSortDir(d => d === 'asc' ? 'desc' : 'asc');
                else { setListSortField('createdAt'); setListSortDir('desc'); }
              }}
            >
              Created {listSortField === 'createdAt' ? (listSortDir === 'asc' ? '↑' : '↓') : ''}
            </span>
          </div>
          {(() => {
            const sorted = [...pages];
            sorted.sort((a, b) => {
              const aVal = a[listSortField] || '';
              const bVal = b[listSortField] || '';
              const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
              return listSortDir === 'asc' ? cmp : -cmp;
            });
            return sorted.length > 0 ? sorted.map(page => (
              <Link key={page.id} to={`/page/${page.id}`} className="list-row">
                <span className="list-cell list-cell-title">{page.title}</span>
                <span className="list-cell">
                  {page.kanbanColumn && (
                    <span className="tag-small">{page.kanbanColumn}</span>
                  )}
                </span>
                <span className="list-cell list-cell-date">
                  {page.dueDate ? new Date(page.dueDate).toLocaleDateString() : '—'}
                </span>
                <span className="list-cell list-cell-date">
                  {new Date(page.createdAt).toLocaleDateString()}
                </span>
              </Link>
            )) : (
              <div className="list-empty">No pages yet</div>
            );
          })()}
        </div>
      )}

      {showCreateModal && (
        <CreatePageModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
