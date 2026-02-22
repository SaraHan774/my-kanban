import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { fileSystemService, pageService, markdownService } from '@/services';
import { CreatePageModal } from '@/components/CreatePageModal';
import { CreateTodoModal } from '@/components/CreateTodoModal';
import { ContextMenu } from '@/components/ContextMenu';
import './Home.css';

const DEFAULT_PALETTE = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function Home() {
  const {
    hasFileSystemAccess, setHasFileSystemAccess, setSidebarOpen,
    pages, updatePageInStore, columnColors,
    columnOrder, setColumnOrder,
    boardDensity,
    boardView, setBoardView,
  } = useStore();
  const [listSortField, setListSortField] = useState<'title' | 'createdAt' | 'dueDate' | 'kanbanColumn'>('title');
  const [listSortDir, setListSortDir] = useState<'asc' | 'desc'>('asc');
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTodoModal, setShowTodoModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; pageId: string } | null>(null);
  const [previewCard, setPreviewCard] = useState<{ id: string; html: string; rect: DOMRect } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // NEW: Filter root-level pages (no parentId) for Home Kanban board
  // Pages with parentId belong to other boards (e.g., nested kanban boards)
  const rootPages = pages.filter(p => !p.parentId);

  // Derive columns from all unique kanbanColumn values (case-insensitive dedup)
  const unsortedColumns = Array.from(
    rootPages.map(p => p.kanbanColumn).filter(Boolean).reduce((map, col) => {
      const key = (col as string).toLowerCase();
      if (!map.has(key)) map.set(key, col as string);
      return map;
    }, new Map<string, string>()).values()
  );

  // Sort columns by persisted order; unknown columns go to the end
  const columns = [...unsortedColumns].sort((a, b) => {
    const aIdx = columnOrder.indexOf(a.toLowerCase());
    const bIdx = columnOrder.indexOf(b.toLowerCase());
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  // Create a stable color mapping based on alphabetically sorted columns
  // This ensures each column always gets the same color regardless of display order
  const sortedColumnNames = [...unsortedColumns].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const getColumnColor = (columnName: string) => {
    const customColor = columnColors[columnName.toLowerCase()];
    if (customColor) return customColor;
    const stableIndex = sortedColumnNames.findIndex(c => c.toLowerCase() === columnName.toLowerCase());
    return DEFAULT_PALETTE[stableIndex % DEFAULT_PALETTE.length];
  };

  const hasUncategorized = rootPages.some(p => !p.kanbanColumn);

  // --- Card drag & drop ---
  const handleDragStart = (cardId: string, e: React.DragEvent) => {
    setDraggedCardId(cardId);
    e.dataTransfer.setData('text/card', cardId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  // --- Column drag & drop ---
  const handleColumnDragStart = (col: string, e: React.DragEvent) => {
    setDraggedColumn(col);
    e.dataTransfer.setData('text/column', col);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleColumnDragOver = (e: React.DragEvent) => {
    // Only accept column drags, not card drags
    if (draggedColumn) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleColumnDrop = (targetCol: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedColumn || draggedColumn === targetCol) {
      setDraggedColumn(null);
      return;
    }

    // Build a full order list from the current columns (lowercase keys)
    const currentOrder = columns.map(c => c.toLowerCase());
    const fromIdx = currentOrder.indexOf(draggedColumn.toLowerCase());
    const toIdx = currentOrder.indexOf(targetCol.toLowerCase());
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedColumn(null);
      return;
    }

    const newOrder = [...currentOrder];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, draggedColumn.toLowerCase());
    setColumnOrder(newOrder);
    setDraggedColumn(null);
  };

  const handleDrop = async (columnTag: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

  const handleDropUncategorized = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

  // Pin/Unpin card
  const handleTogglePin = async (cardId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const card = pages.find(c => c.id === cardId);
    if (!card) return;

    const updatedCard = {
      ...card,
      pinned: !card.pinned,
      pinnedAt: !card.pinned ? new Date().toISOString() : undefined,
    };

    try {
      await pageService.updatePage(updatedCard);
      updatePageInStore(updatedCard);
    } catch (error) {
      console.error('Failed to pin/unpin card:', error);
    }
  };

  // Hover preview handlers
  const handleCardMouseEnter = (card: { id: string; content: string }, e: React.MouseEvent) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (!card.content.trim()) return;
    const target = e.currentTarget as HTMLElement;
    hoverTimerRef.current = setTimeout(async () => {
      const rect = target.getBoundingClientRect();
      const html = await markdownService.toHtml(card.content);
      setPreviewCard({ id: card.id, html, rect });
    }, 350);
  };

  const handleCardMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setPreviewCard(null);
  };

  // Context menu handlers
  const handleCardContextMenu = (e: React.MouseEvent, pageId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, pageId });
  };

  const handleCopyLink = async (pageId: string) => {
    const link = `${window.location.origin}/page/${pageId}`;
    try {
      await navigator.clipboard.writeText(link);
      // You could add a toast notification here
      console.log('Link copied to clipboard:', link);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  // No pages and no columns yet
  if (pages.length === 0) {
    return (
      <div className="home">
        <div className="home-empty">
          <h2>No pages yet</h2>
          <p>Create your first page to get started.</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary new-page-btn" onClick={() => setShowTodoModal(true)}>
              <span className="material-symbols-outlined">check_circle</span>
              Todo
            </button>
            <button className="btn btn-primary new-page-btn" onClick={() => setShowCreateModal(true)}>
              <span className="material-symbols-outlined">add_circle</span>
              New Page
            </button>
          </div>
          {showCreateModal && (
            <CreatePageModal onClose={() => setShowCreateModal(false)} />
          )}
          {showTodoModal && (
            <CreateTodoModal onClose={() => setShowTodoModal(false)} />
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
            <div className={`toggle-slider ${boardView === 'list' ? 'slider-right' : ''}`}></div>
            <button
              className={`toggle-btn ${boardView === 'kanban' ? 'active' : ''}`}
              onClick={() => setBoardView('kanban')}
            >
              <span className="material-symbols-outlined">view_kanban</span>
              Board
            </button>
            <button
              className={`toggle-btn ${boardView === 'list' ? 'active' : ''}`}
              onClick={() => setBoardView('list')}
            >
              <span className="material-symbols-outlined">list</span>
              List
            </button>
          </div>
          <button className="btn btn-primary new-page-btn" onClick={() => setShowTodoModal(true)}>
            <span className="material-symbols-outlined">check_circle</span>
            Todo
          </button>
          <button className="btn btn-primary new-page-btn" onClick={() => setShowCreateModal(true)}>
            <span className="material-symbols-outlined">add_circle</span>
            New Page
          </button>
        </div>
      </div>

      {boardView === 'kanban' ? (
        <div className="kanban-board">
          {columns.map((col) => {
            const columnCards = rootPages
              .filter(p => p.kanbanColumn?.toLowerCase() === col.toLowerCase())
              .sort((a, b) => {
                // Pinned cards first
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                // If both pinned, sort by pinnedAt (most recent first)
                if (a.pinned && b.pinned) {
                  return (b.pinnedAt || '').localeCompare(a.pinnedAt || '');
                }
                // Non-pinned cards sorted by creation date (newest first)
                return b.createdAt.localeCompare(a.createdAt);
              });
            const color = getColumnColor(col);
            return (
              <div
                key={col}
                className={`kanban-column ${boardDensity === 'compact' ? 'compact-density' : ''} ${draggedCardId ? 'droppable' : ''} ${draggedColumn === col ? 'column-dragging' : ''} ${draggedColumn && draggedColumn !== col ? 'column-drop-target' : ''}`}
                style={{ borderTopColor: color }}
                onDragOver={(e) => { handleDragOver(e); handleColumnDragOver(e); }}
                onDrop={(e) => { if (draggedColumn) handleColumnDrop(col, e); else handleDrop(col, e); }}
              >
                <div
                  className="column-header"
                  style={{ borderTopColor: color }}
                  draggable
                  onDragStart={(e) => handleColumnDragStart(col, e)}
                  onDragEnd={() => setDraggedColumn(null)}
                >
                  <h3><span className="material-symbols-outlined column-drag-handle">drag_indicator</span>{col}</h3>
                  <span className="card-count">{columnCards.length}</span>
                </div>
                <div className="column-content">
                  {columnCards.map(card => (
                    <div
                      key={card.id}
                      className={`kanban-card ${draggedCardId === card.id ? 'dragging' : ''} ${card.pinned ? 'pinned' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(card.id, e)}
                      onDragEnd={() => setDraggedCardId(null)}
                      onContextMenu={(e) => handleCardContextMenu(e, card.id)}
                      onMouseEnter={(e) => handleCardMouseEnter(card, e)}
                      onMouseLeave={handleCardMouseLeave}
                    >
                      <button
                        className={`pin-btn ${card.pinned ? 'pinned' : ''}`}
                        onClick={(e) => handleTogglePin(card.id, e)}
                        title={card.pinned ? 'Unpin from top' : 'Pin to top'}
                      >
                        <span className="material-symbols-outlined">
                          {card.pinned ? 'keep' : 'keep_off'}
                        </span>
                      </button>
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
              className={`kanban-column ${boardDensity === 'compact' ? 'compact-density' : ''} ${draggedCardId ? 'droppable' : ''}`}
              style={{ borderTopColor: '#6b7280' }}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropUncategorized(e)}
            >
              <div className="column-header" style={{ borderTopColor: '#6b7280' }}>
                <h3>Uncategorized</h3>
                <span className="card-count">
                  {rootPages.filter(p => !p.kanbanColumn).length}
                </span>
              </div>
              <div className="column-content">
                {rootPages
                  .filter(p => !p.kanbanColumn)
                  .sort((a, b) => {
                    // Pinned cards first
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    // If both pinned, sort by pinnedAt (most recent first)
                    if (a.pinned && b.pinned) {
                      return (b.pinnedAt || '').localeCompare(a.pinnedAt || '');
                    }
                    // Non-pinned cards sorted by creation date (newest first)
                    return b.createdAt.localeCompare(a.createdAt);
                  })
                  .map(card => (
                    <div
                      key={card.id}
                      className={`kanban-card ${draggedCardId === card.id ? 'dragging' : ''} ${card.pinned ? 'pinned' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(card.id, e)}
                      onDragEnd={() => setDraggedCardId(null)}
                      onContextMenu={(e) => handleCardContextMenu(e, card.id)}
                      onMouseEnter={(e) => handleCardMouseEnter(card, e)}
                      onMouseLeave={handleCardMouseLeave}
                    >
                      <button
                        className={`pin-btn ${card.pinned ? 'pinned' : ''}`}
                        onClick={(e) => handleTogglePin(card.id, e)}
                        title={card.pinned ? 'Unpin from top' : 'Pin to top'}
                      >
                        <span className="material-symbols-outlined">
                          {card.pinned ? 'keep' : 'keep_off'}
                        </span>
                      </button>
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
            <span
              className={`list-col-header sortable ${listSortField === 'kanbanColumn' ? 'active' : ''}`}
              onClick={() => {
                if (listSortField === 'kanbanColumn') setListSortDir(d => d === 'asc' ? 'desc' : 'asc');
                else { setListSortField('kanbanColumn'); setListSortDir('asc'); }
              }}
            >
              Column {listSortField === 'kanbanColumn' ? (listSortDir === 'asc' ? '↑' : '↓') : ''}
            </span>
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
            const sorted = [...rootPages];
            sorted.sort((a, b) => {
              let aVal: string | undefined;
              let bVal: string | undefined;

              if (listSortField === 'kanbanColumn') {
                aVal = a.kanbanColumn?.toLowerCase() || '';
                bVal = b.kanbanColumn?.toLowerCase() || '';
              } else {
                aVal = a[listSortField] || '';
                bVal = b[listSortField] || '';
              }

              const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
              return listSortDir === 'asc' ? cmp : -cmp;
            });
            return sorted.length > 0 ? sorted.map(page => (
              <Link key={page.id} to={`/page/${page.id}`} className="list-row">
                <span className="list-cell list-cell-title">{page.title}</span>
                <span className="list-cell">
                  {page.kanbanColumn && (
                    <span className="tag-small" style={{ backgroundColor: getColumnColor(page.kanbanColumn), color: 'white' }}>
                      {page.kanbanColumn}
                    </span>
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

      {previewCard && (() => {
        const { rect, html } = previewCard;
        const previewWidth = 320;
        const previewMaxHeight = 420;
        const left = rect.right + 12 + previewWidth > window.innerWidth
          ? rect.left - previewWidth - 12
          : rect.right + 12;
        const cardMidY = rect.top + rect.height / 2;
        // Clamp so the preview doesn't clip at viewport edges (accounting for transform: translateY(-50%))
        const top = Math.max(previewMaxHeight / 2 + 8, Math.min(cardMidY, window.innerHeight - previewMaxHeight / 2 - 8));
        return (
          <div
            className="card-hover-preview markdown-content"
            style={{ left, top }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })()}

      {showCreateModal && (
        <CreatePageModal onClose={() => setShowCreateModal(false)} />
      )}
      {showTodoModal && (
        <CreateTodoModal onClose={() => setShowTodoModal(false)} />
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: 'Copy Link',
              icon: 'link',
              onClick: () => handleCopyLink(contextMenu.pageId),
            },
          ]}
        />
      )}
    </div>
  );
}
