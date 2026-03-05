import { useState, useRef, useEffect } from 'react';

interface PageHeaderProps {
  onBack: () => void;
  onToggleToc: () => void;
  onToggleWidth: () => void;
  onCopyLink: () => void;
  onToggleMemoMode: () => void;
  onToggleHighlights: () => void;
  onToggleTerminal: () => void;
  onDelete: () => void;
  pageWidth: 'narrow' | 'wide';
  memoMode: boolean;
  highlightsVisible: boolean;
  showTerminal: boolean;
}

export function PageHeader({
  onBack,
  onToggleToc,
  onToggleWidth,
  onCopyLink,
  onToggleMemoMode,
  onToggleHighlights,
  onToggleTerminal,
  onDelete,
  pageWidth,
  memoMode,
  highlightsVisible,
  showTerminal,
}: PageHeaderProps) {
  const [showPageMenu, setShowPageMenu] = useState(false);
  const pageMenuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pageMenuRef.current && !pageMenuRef.current.contains(e.target as Node)) {
        setShowPageMenu(false);
      }
    };

    if (showPageMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPageMenu]);

  return (
    <div className="page-actions-bar">
      <button className="btn-icon" onClick={onBack} title="Go back">
        <span className="material-symbols-outlined">arrow_back</span>
      </button>
      <div className="page-actions">
        <button
          className="btn btn-secondary btn-icon"
          onClick={onToggleToc}
          title="Table of Contents (Cmd+Shift+T)"
        >
          <span className="material-symbols-outlined">toc</span>
        </button>
        <button
          className="btn btn-secondary btn-icon"
          onClick={onToggleWidth}
          title={pageWidth === 'narrow' ? 'Switch to wide layout' : 'Switch to narrow layout'}
        >
          <span className="material-symbols-outlined">
            {pageWidth === 'narrow' ? 'width_wide' : 'width_normal'}
          </span>
        </button>
        <div className="page-menu-container" ref={pageMenuRef}>
          <button
            className="btn btn-secondary btn-icon"
            onClick={() => setShowPageMenu(!showPageMenu)}
            title="More options"
          >
            <span className="material-symbols-outlined">more_vert</span>
          </button>
          {showPageMenu && (
            <div className="page-menu-dropdown">
              <button
                className="page-menu-item copy-link-btn"
                onClick={() => {
                  onCopyLink();
                  setShowPageMenu(false);
                }}
              >
                <span className="material-symbols-outlined">link</span>
                Copy Link
              </button>
              <button
                className="page-menu-item"
                onClick={() => {
                  onToggleMemoMode();
                  setShowPageMenu(false);
                }}
              >
                <span className="material-symbols-outlined">
                  {memoMode ? 'close' : 'sticky_note_2'}
                </span>
                {memoMode ? 'Exit Memo Mode' : 'Memo Mode'}
              </button>
              <button
                className="page-menu-item"
                onClick={() => {
                  onToggleHighlights();
                  setShowPageMenu(false);
                }}
              >
                <span className="material-symbols-outlined">
                  {highlightsVisible ? 'visibility_off' : 'visibility'}
                </span>
                {highlightsVisible ? 'Hide Highlights' : 'Show Highlights'}
              </button>
              <button
                className="page-menu-item"
                onClick={() => {
                  onToggleTerminal();
                  setShowPageMenu(false);
                }}
              >
                <span className="material-symbols-outlined">terminal</span>
                {showTerminal ? 'Hide Terminal' : 'Show Terminal'}
              </button>
              <div className="page-menu-divider"></div>
              <button
                className="page-menu-item page-menu-item-danger"
                onClick={() => {
                  setShowPageMenu(false);
                  onDelete();
                }}
              >
                <span className="material-symbols-outlined">delete</span>
                Delete Page
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
