import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { pageService } from '@/services';
import { CreatePageModal } from './CreatePageModal';
import './Sidebar.css';

export function Sidebar() {
  const { pages, setPages, hasFileSystemAccess, setSidebarOpen, activeFilters, setActiveFilters, sortOptions, setSortOptions } = useStore();
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createParentPath, setCreateParentPath] = useState<string | undefined>();
  const [collapsedPages, setCollapsedPages] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState(activeFilters.searchText);

  useEffect(() => {
    if (hasFileSystemAccess) {
      loadPages();
    }
  }, [hasFileSystemAccess]);

  const loadPages = async () => {
    setLoading(true);
    try {
      const allPages = await pageService.getAllPages();
      setPages(allPages);
    } catch (error) {
      console.error('Failed to load pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    setActiveFilters({ ...activeFilters, searchText: value });
  };

  const toggleCollapse = (path: string) => {
    setCollapsedPages(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleCreateSubPage = (parentPath: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCreateParentPath(parentPath);
    setShowCreateModal(true);
  };

  const filteredPages = pages.filter(page => {
    if (searchText) {
      const s = searchText.toLowerCase();
      if (!page.title.toLowerCase().includes(s) && !page.content.toLowerCase().includes(s)) {
        return false;
      }
    }
    if (activeFilters.tags.length > 0) {
      if (!activeFilters.tags.some(tag => page.tags.some(t => t.toLowerCase() === tag.toLowerCase()))) {
        return false;
      }
    }
    return true;
  });

  if (sortOptions) {
    filteredPages.sort((a, b) => {
      const aVal = a[sortOptions.field] || '';
      const bVal = b[sortOptions.field] || '';
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortOptions.direction === 'asc' ? cmp : -cmp;
    });
  }

  const allTags = Array.from(
    pages.flatMap(p => p.tags).reduce((map, tag) => {
      const key = tag.toLowerCase();
      if (!map.has(key)) map.set(key, tag);
      return map;
    }, new Map<string, string>()).values()
  ).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const toggleTag = (tag: string) => {
    const currentTags = activeFilters.tags;
    const newTags = currentTags.some(t => t.toLowerCase() === tag.toLowerCase())
      ? currentTags.filter(t => t.toLowerCase() !== tag.toLowerCase())
      : [...currentTags, tag];
    setActiveFilters({ ...activeFilters, tags: newTags });
  };

  const renderPageTree = (pagePath: string, level: number = 0) => {
    const page = filteredPages.find(p => p.path === pagePath);
    if (!page) return null;

    const children = filteredPages.filter(p => {
      const parentPath = p.path.split('/').slice(0, -1).join('/');
      return parentPath === pagePath;
    });

    const isCollapsed = collapsedPages.has(pagePath);

    return (
      <div key={page.id} style={{ marginLeft: `${level * 0.75}rem` }}>
        <div className="page-item">
          {children.length > 0 ? (
            <button
              className="collapse-btn"
              onClick={() => toggleCollapse(pagePath)}
              title={isCollapsed ? 'Expand' : 'Collapse'}
            >
              {isCollapsed ? '▸' : '▾'}
            </button>
          ) : (
            <span className="collapse-btn-placeholder" />
          )}
          <Link to={`/page/${page.id}`} className="page-link">
            <span className="page-icon">📄</span>
            <span className="page-title">{page.title}</span>
            {page.tags.length > 0 && (
              <span className="page-tags">
                {page.tags.slice(0, 2).join(', ')}
              </span>
            )}
          </Link>
          <button
            className="btn-icon btn-add-child"
            onClick={(e) => handleCreateSubPage(page.path, e)}
            title="Add sub-page"
          >
            +
          </button>
        </div>
        {!isCollapsed && children.length > 0 && (
          <div className="page-children">
            {children.map(child => renderPageTree(child.path, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootPages = filteredPages.filter(p => p.path.split('/').length === 2);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>My Kanban</h2>
        <div className="sidebar-header-actions">
          <button
            className="btn-icon"
            onClick={() => {
              setCreateParentPath(undefined);
              setShowCreateModal(true);
            }}
            title="New page"
          >
            +
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="btn-icon"
            title="Close sidebar"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Search pages..."
          value={searchText}
          onChange={e => handleSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {allTags.length > 0 && (
        <div className="sidebar-tags">
          {allTags.map(tag => (
            <button
              key={tag}
              className={`filter-tag ${activeFilters.tags.includes(tag) ? 'active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
          {activeFilters.tags.length > 0 && (
            <button
              className="filter-tag clear-tag"
              onClick={() => setActiveFilters({ ...activeFilters, tags: [] })}
            >
              clear
            </button>
          )}
        </div>
      )}

      <div className="sidebar-sort">
        <select
          className="sort-select"
          value={sortOptions?.field || ''}
          onChange={e => {
            const field = e.target.value;
            if (!field) {
              setSortOptions(null);
            } else {
              setSortOptions({
                field: field as 'title' | 'createdAt' | 'updatedAt' | 'dueDate',
                direction: sortOptions?.direction || 'asc',
              });
            }
          }}
        >
          <option value="">Default order</option>
          <option value="title">Title</option>
          <option value="createdAt">Created</option>
          <option value="updatedAt">Updated</option>
          <option value="dueDate">Due Date</option>
        </select>
        {sortOptions && (
          <button
            className="sort-dir-btn"
            onClick={() => setSortOptions({
              ...sortOptions,
              direction: sortOptions.direction === 'asc' ? 'desc' : 'asc',
            })}
            title={sortOptions.direction === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortOptions.direction === 'asc' ? '↑' : '↓'}
          </button>
        )}
      </div>

      <div className="sidebar-content">
        {loading ? (
          <div className="loading">Loading pages...</div>
        ) : rootPages.length > 0 ? (
          <div className="pages-tree">
            {rootPages.map(page => renderPageTree(page.path))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No pages yet</p>
            <p className="text-secondary">Click + to create your first page</p>
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <button onClick={loadPages} className="btn btn-secondary" disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {showCreateModal && (
        <CreatePageModal
          parentPath={createParentPath}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </aside>
  );
}
