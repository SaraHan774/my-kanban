import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './SideBrowserNative.css';

interface SideBrowserNativeProps {
  url: string;
  onClose: () => void;
}

export function SideBrowserNative({ url, onClose }: SideBrowserNativeProps) {
  const [error, setError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let checkInterval: NodeJS.Timeout;

    const openBrowser = async () => {
      try {
        console.log('Opening side browser for URL:', url);

        // Import webview window dynamically
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const mainWindow = getCurrentWebviewWindow();

        // Get window position and size
        const position = await mainWindow.outerPosition();
        const size = await mainWindow.outerSize();

        console.log('Main window bounds:', { position, size });

        const bounds = {
          x: position.x,
          y: position.y,
          width: size.width,
          height: size.height,
        };

        // Open side browser window
        await invoke('open_side_browser', { url, mainBounds: bounds });

        console.log('Side browser opened successfully');

        if (!isMounted) return;
        setIsOpening(false);

        // Listen for the side browser window closing
        checkInterval = setInterval(async () => {
          try {
            const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
            const sideBrowser = WebviewWindow.getByLabel('side-browser');
            if (!sideBrowser) {
              clearInterval(checkInterval);
              if (isMounted) {
                console.log('Side browser closed');
                onClose();
              }
            }
          } catch (e) {
            console.error('Error checking side browser:', e);
            clearInterval(checkInterval);
          }
        }, 500);
      } catch (err) {
        console.error('Failed to open side browser:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to open browser window');
          setIsOpening(false);
        }
      }
    };

    openBrowser();

    return () => {
      isMounted = false;
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      // Close the side browser when component unmounts
      invoke('close_side_browser').catch(console.error);
    };
  }, [url, onClose]);

  if (error) {
    return (
      <div className="side-browser-error">
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <h3>Failed to Open Browser Window</h3>
          <p>{error}</p>
          <div className="error-details">
            <p>Tip: Make sure your Tauri app is running in dev mode or built correctly.</p>
          </div>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  // Show a placeholder in the main window
  return (
    <div className="side-browser-placeholder">
      <div className="placeholder-content">
        <div className="placeholder-icon">
          <span className="material-symbols-outlined">
            {isOpening ? 'hourglass_empty' : 'open_in_new'}
          </span>
        </div>
        <h3>{isOpening ? 'Opening Browser...' : 'Browser Opened'}</h3>
        <p>The browser is displayed in a separate window on the right side.</p>
        <div className="placeholder-url">{url}</div>
        <button className="btn btn-primary" onClick={onClose}>
          Close Browser
        </button>
      </div>
    </div>
  );
}
