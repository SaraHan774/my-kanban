import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './SideBrowser.css';

interface SideBrowserProps {
  url: string;
  onClose: () => void;
}

export function SideBrowser({ url, onClose }: SideBrowserProps) {
  const [currentUrl, setCurrentUrl] = useState(url);
  const [inputUrl, setInputUrl] = useState(url);
  const [isLoading, setIsLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setCurrentUrl(url);
    setInputUrl(url);
    setIsBlocked(false);
    setIsLoading(true);

    // Set a timeout to detect if iframe fails to load
    loadTimeoutRef.current = setTimeout(() => {
      // After timeout, check if we can access the iframe
      try {
        const iframe = iframeRef.current;
        if (iframe && iframe.contentWindow) {
          const _ = iframe.contentWindow.location.href;
          // If successful, it's just slow loading
          setIsLoading(false);
        }
      } catch (error) {
        // Cannot access - likely blocked
        setIsBlocked(true);
        setIsLoading(false);
      }
    }, 3000); // 3 seconds timeout

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [url]);

  const handleNavigate = () => {
    setCurrentUrl(inputUrl);
    setIsLoading(true);
    setIsBlocked(false);

    // Reset timeout for new navigation
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
    loadTimeoutRef.current = setTimeout(() => {
      try {
        const iframe = iframeRef.current;
        if (iframe && iframe.contentWindow) {
          const _ = iframe.contentWindow.location.href;
          setIsLoading(false);
        }
      } catch (error) {
        setIsBlocked(true);
        setIsLoading(false);
      }
    }, 3000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNavigate();
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsBlocked(false);
      setIsLoading(true);
      iframeRef.current.src = currentUrl;

      // Reset timeout
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
      loadTimeoutRef.current = setTimeout(() => {
        try {
          const iframe = iframeRef.current;
          if (iframe && iframe.contentWindow) {
            const _ = iframe.contentWindow.location.href;
            setIsLoading(false);
          }
        } catch (error) {
          setIsBlocked(true);
          setIsLoading(false);
        }
      }, 3000);
    }
  };

  const handleIframeLoad = () => {
    // Try to access iframe content to detect X-Frame-Options blocking
    try {
      const iframe = iframeRef.current;
      if (iframe && iframe.contentWindow) {
        // Attempt to access the iframe's location - this will throw if blocked
        const _ = iframe.contentWindow.location.href;
        // If we got here, iframe loaded successfully
        setIsLoading(false);
        setIsBlocked(false);
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
        }
      }
    } catch (error) {
      // X-Frame-Options or CORS blocked the iframe
      console.warn('Iframe blocked by X-Frame-Options or CORS:', error);
      setIsBlocked(true);
      setIsLoading(false);
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    }
  };

  const handleOpenInExternal = async () => {
    try {
      // Use Tauri's opener plugin via Rust backend
      const { open } = await import('@tauri-apps/plugin-opener');
      await open(currentUrl);
    } catch (error) {
      console.error('Failed to open URL in external browser:', error);
      // Fallback: try using window.open
      window.open(currentUrl, '_blank');
    }
  };

  return (
    <div className="side-browser">
      <div className="side-browser-header">
        <button
          className="browser-btn browser-btn-icon"
          onClick={handleRefresh}
          title="Refresh"
        >
          <span className="material-symbols-outlined">refresh</span>
        </button>

        <input
          type="text"
          className="browser-url-bar"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter URL..."
        />

        <button
          className="browser-btn browser-btn-icon"
          onClick={onClose}
          title="Close browser"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="side-browser-content">
        {isLoading && !isBlocked && (
          <div className="browser-loading">
            <div className="loading-spinner"></div>
            <span>Loading...</span>
          </div>
        )}

        {isBlocked && (
          <div className="browser-blocked">
            <div className="blocked-icon">
              <span className="material-symbols-outlined">block</span>
            </div>
            <h3>Cannot display this page</h3>
            <p>This website doesn't allow embedding in frames.</p>
            <div className="blocked-url">{currentUrl}</div>
            <div className="blocked-actions">
              <button className="btn btn-primary" onClick={handleOpenInExternal}>
                <span className="material-symbols-outlined">open_in_new</span>
                Open in Browser
              </button>
              <button className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={currentUrl}
          title="Side Browser"
          className={`browser-iframe ${isBlocked ? 'hidden' : ''}`}
          onLoad={handleIframeLoad}
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </div>
  );
}
