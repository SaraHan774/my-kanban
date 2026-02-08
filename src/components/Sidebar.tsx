import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { pageService } from '@/services';
import { Page } from '@/types';
import './Sidebar.css';

export function Sidebar() {
  const { pages, setPages, hasFileSystemAccess, setSidebarOpen } = useStore();
  const [loading, setLoading] = useState(false);

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

  const renderPageTree = (pagePath: string, level: number = 0) => {
    const page = pages.find(p => p.path === pagePath);
    if (!page) return null;

    const children = pages.filter(p => {
      const parentPath = p.path.split('/').slice(0, -1).join('/');
      return parentPath === pagePath;
    });

    return (
      <div key={page.id} style={{ marginLeft: `${level * 1}rem` }}>
        <Link to={`/page/${page.id}`} className="page-link">
          <span className="page-icon">
            {page.viewType === 'kanban' ? '📋' : '📄'}
          </span>
          <span className="page-title">{page.title}</span>
          {page.tags.length > 0 && (
            <span className="page-tags">
              {page.tags.slice(0, 2).join(', ')}
            </span>
          )}
        </Link>
        {children.length > 0 && (
          <div className="page-children">
            {children.map(child => renderPageTree(child.path, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootPages = pages.filter(p => p.path.split('/').length === 2); // workspace/PageName

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>My Kanban</h2>
        <button
          onClick={() => setSidebarOpen(false)}
          className="btn-icon"
          title="Close sidebar"
        >
          ✕
        </button>
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
            <p className="text-secondary">Create your first page to get started</p>
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <button onClick={loadPages} className="btn btn-secondary" disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </aside>
  );
}
