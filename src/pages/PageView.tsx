import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { pageService, markdownService } from '@/services';
import { Page } from '@/types';
import { PageEditor } from '@/components/PageEditor';
import './PageView.css';

export function PageView() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { pages, removePage, updatePageInStore, sidebarOpen, setSidebarOpen, columnColors } = useStore();
  const [page, setPage] = useState<Page | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pageId) {
      loadPage(pageId);
      setEditing(false);
    }
  }, [pageId]);

  // Retry when pages become available (e.g., after refresh restores file system access)
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
        const html = await markdownService.toHtml(fullPage.content);
        setHtmlContent(html);
      }
    } catch (error) {
      console.error('Failed to load page:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle the N-th checkbox in markdown content and auto-save
  const handleCheckboxToggle = useCallback(async (checkboxIndex: number) => {
    if (!page) return;

    let idx = 0;
    const newContent = page.content.replace(/- \[([ x])\]/g, (match, state) => {
      if (idx++ === checkboxIndex) {
        return state === 'x' ? '- [ ]' : '- [x]';
      }
      return match;
    });

    const updatedPage = { ...page, content: newContent, updatedAt: new Date().toISOString() };
    setPage(updatedPage);
    updatePageInStore(updatedPage);

    const html = await markdownService.toHtml(newContent);
    setHtmlContent(html);

    try {
      await pageService.updatePage(updatedPage);
    } catch (err) {
      console.error('Failed to save checkbox state:', err);
    }
  }, [page, updatePageInStore]);

  // Attach click handlers to rendered checkboxes
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const handlers: Array<() => void> = [];

    checkboxes.forEach((cb, index) => {
      cb.disabled = false;
      cb.style.cursor = 'pointer';
      const handler = () => handleCheckboxToggle(index);
      cb.addEventListener('click', handler);
      handlers.push(handler);
    });

    return () => {
      checkboxes.forEach((cb, index) => {
        cb.removeEventListener('click', handlers[index]);
      });
    };
  }, [htmlContent, handleCheckboxToggle]);

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

  const handleEditorSave = (updatedPage: Page) => {
    setPage(updatedPage);
    markdownService.toHtml(updatedPage.content).then(setHtmlContent);
    setEditing(false);
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

  if (editing) {
    return (
      <div className="page-view">
        <PageEditor
          page={page}
          onSave={handleEditorSave}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="page-view">
      <div className="page-header">
        <div className="page-header-top">
          {!sidebarOpen && (
            <button className="btn-icon" onClick={() => setSidebarOpen(true)} title="Open sidebar">
              ☰
            </button>
          )}
          <h1>{page.title}</h1>
          <div className="page-actions">
            <button className="btn btn-secondary" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className="btn btn-danger" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>
        <div className="page-meta">
          {page.kanbanColumn && (
            <div
              className="page-column-badge"
              style={columnColors[page.kanbanColumn.toLowerCase()]
                ? { backgroundColor: columnColors[page.kanbanColumn.toLowerCase()] }
                : undefined}
            >
              {page.kanbanColumn}
            </div>
          )}
          {page.dueDate && (
            <div className="due-date">
              Due: {new Date(page.dueDate).toLocaleDateString()}
            </div>
          )}
          <div className="page-dates">
            <span>Created: {new Date(page.createdAt).toLocaleDateString()}</span>
            <span>Updated: {new Date(page.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="document-view">
        <div
          ref={contentRef}
          className="markdown-content"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
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
  );
}
