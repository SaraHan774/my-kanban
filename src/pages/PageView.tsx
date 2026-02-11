import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { pageService, markdownService, resolveImagesInHtml, clearImageCache } from '@/services';
import { Page } from '@/types';
import { PageEditor } from '@/components/PageEditor';
import { FindBar } from '@/components/FindBar';
import { useMermaid } from '@/hooks/useMermaid';
import { convertWikiLinksToMarkdown } from '@/utils/wikiLinks';
import { openExternalUrl } from '@/lib/openExternal';
import './PageView.css';

export function PageView() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { pages, removePage, updatePageInStore, columnColors } = useStore();
  const [page, setPage] = useState<Page | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [showFindBar, setShowFindBar] = useState(false);
  const [zoomedDiagram, setZoomedDiagram] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Render mermaid diagrams after HTML content updates
  useMermaid(contentRef, htmlContent);

  // Clean up blob URLs on unmount or page change
  useEffect(() => {
    return () => { clearImageCache(); };
  }, [pageId]);

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
        // Convert wiki-style links before rendering markdown
        const contentWithLinks = convertWikiLinksToMarkdown(fullPage.content, pages);
        let html = await markdownService.toHtml(contentWithLinks);
        html = await resolveImagesInHtml(html, fullPage.path);
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

    // Convert wiki-style links before rendering markdown
    const contentWithLinks = convertWikiLinksToMarkdown(newContent, pages);
    let html = await markdownService.toHtml(contentWithLinks);
    html = await resolveImagesInHtml(html, page.path);
    setHtmlContent(html);

    try {
      await pageService.updatePage(updatedPage);
    } catch (err) {
      console.error('Failed to save checkbox state:', err);
    }
  }, [page, updatePageInStore]);

  // Attach click handlers to internal links for SPA navigation
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const links = container.querySelectorAll<HTMLAnchorElement>('a[href^="/page/"]');
    const handlers: Array<(e: Event) => void> = [];

    links.forEach((link) => {
      const handler = (e: Event) => {
        e.preventDefault();
        const href = link.getAttribute('href');
        if (href) {
          const targetPageId = href.replace('/page/', '');
          // Only navigate if the target page is different from the current page
          if (targetPageId !== pageId) {
            navigate(href);
          }
        }
      };
      link.addEventListener('click', handler);
      handlers.push(handler);
    });

    return () => {
      links.forEach((link, index) => {
        link.removeEventListener('click', handlers[index]);
      });
    };
  }, [htmlContent, navigate, pageId]);

  // Attach click handlers to external links to open in browser
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const externalLinks = container.querySelectorAll<HTMLAnchorElement>('a[href^="http://"], a[href^="https://"]');
    const handlers: Array<(e: Event) => void> = [];

    externalLinks.forEach((link) => {
      const handler = (e: Event) => {
        e.preventDefault();
        const href = link.getAttribute('href');
        if (href) {
          openExternalUrl(href);
        }
      };
      link.addEventListener('click', handler);
      handlers.push(handler);
    });

    return () => {
      externalLinks.forEach((link, index) => {
        link.removeEventListener('click', handlers[index]);
      });
    };
  }, [htmlContent]);

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

  // Attach click handlers to mermaid diagrams for zoom functionality
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const diagrams = container.querySelectorAll<HTMLElement>('.mermaid-block');
    const handlers: Array<() => void> = [];

    diagrams.forEach((diagram) => {
      const handler = () => {
        // Get the SVG content from the diagram
        const svg = diagram.querySelector('svg');
        if (svg) {
          setZoomedDiagram(svg.outerHTML);
        }
      };
      diagram.addEventListener('click', handler);
      handlers.push(handler);
    });

    return () => {
      diagrams.forEach((diagram, index) => {
        diagram.removeEventListener('click', handlers[index]);
      });
    };
  }, [htmlContent]);

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

  const handleEditorSave = async (updatedPage: Page) => {
    setPage(updatedPage);
    setEditing(false);
    // Reload the page to ensure mermaid diagrams render correctly
    await loadPage(updatedPage.id);
  };

  // Keyboard shortcuts for edit mode and find
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+F for find
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && !editing) {
        e.preventDefault();
        setShowFindBar(prev => !prev);
        return;
      }

      // Prevent Cmd+S when not editing
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && !editing) {
        e.preventDefault();
        return;
      }

      // Cmd+E or just E key to enter edit mode (when not in an input)
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (!editing && !isInputField) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
          e.preventDefault();
          setEditing(true);
        } else if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          setEditing(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editing]);

  // Track scroll position to show/hide scroll to top button
  useEffect(() => {
    const handleScroll = () => {
      // Show button when scrolled down more than 300px
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
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
    <>
      <div className="page-view">
        <div className="page-header">
        <div className="page-header-top">
          <button className="btn-icon" onClick={() => navigate(-1)} title="Go back">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
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
        {showFindBar && (
          <FindBar
            content={page.content}
            contentRef={contentRef}
            onClose={() => setShowFindBar(false)}
          />
        )}
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

      {/* Mermaid diagram zoom modal */}
      {zoomedDiagram && (
        <div
          className="diagram-zoom-modal"
          onClick={() => setZoomedDiagram(null)}
        >
          <div
            className="diagram-zoom-content"
            dangerouslySetInnerHTML={{ __html: zoomedDiagram }}
          />
        </div>
      )}

      {/* Scroll to top button */}
      {showScrollTop && !editing && (
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
