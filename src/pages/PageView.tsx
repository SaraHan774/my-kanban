import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { pageService, markdownService } from '@/services';
import { Page } from '@/types';
import './PageView.css';

export function PageView() {
  const { pageId } = useParams<{ pageId: string }>();
  const { pages } = useStore();
  const [page, setPage] = useState<Page | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (pageId) {
      loadPage(pageId);
    }
  }, [pageId, pages]);

  const loadPage = async (id: string) => {
    setLoading(true);
    try {
      // Find page in store
      const foundPage = pages.find(p => p.id === id);
      if (foundPage) {
        const fullPage = await pageService.loadPageWithChildren(foundPage.path);
        setPage(fullPage);

        // Convert markdown to HTML
        const html = await markdownService.toHtml(fullPage.content);
        setHtmlContent(html);
      }
    } catch (error) {
      console.error('Failed to load page:', error);
    } finally {
      setLoading(false);
    }
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
    <div className="page-view">
      <div className="page-header">
        <h1>{page.title}</h1>
        <div className="page-meta">
          {page.tags.length > 0 && (
            <div className="tags">
              {page.tags.map(tag => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {page.dueDate && (
            <div className="due-date">
              Due: {new Date(page.dueDate).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {page.viewType === 'kanban' ? (
        <div className="kanban-view">
          <div className="kanban-board">
            {page.kanbanColumns?.map(column => (
              <div key={column.id} className="kanban-column">
                <div className="column-header" style={{ backgroundColor: column.color }}>
                  <h3>{column.name}</h3>
                  <span className="card-count">
                    {page.children?.filter(c => c.kanbanColumn === column.id).length || 0}
                  </span>
                </div>
                <div className="column-content">
                  {page.children
                    ?.filter(c => c.kanbanColumn === column.id)
                    .map(card => (
                      <div key={card.id} className="kanban-card">
                        <h4>{card.title}</h4>
                        {card.tags.length > 0 && (
                          <div className="card-tags">
                            {card.tags.map(tag => (
                              <span key={tag} className="tag-small">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="card-excerpt">
                          {markdownService.getExcerpt(card.content)}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="document-view">
          <div
            className="markdown-content"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
      )}

      {page.children && page.children.length > 0 && page.viewType !== 'kanban' && (
        <div className="sub-pages">
          <h2>Sub-pages</h2>
          <div className="sub-pages-list">
            {page.children.map(child => (
              <div key={child.id} className="sub-page-card">
                <h3>{child.title}</h3>
                {child.tags.length > 0 && (
                  <div className="tags">
                    {child.tags.map(tag => (
                      <span key={tag} className="tag-small">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
