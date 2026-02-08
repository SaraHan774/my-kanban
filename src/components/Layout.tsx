import { useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useStore } from '@/store/useStore';
import { fileSystemService } from '@/services';
import './Layout.css';

export function Layout() {
  const { sidebarOpen, setSidebarOpen, hasFileSystemAccess, setHasFileSystemAccess, theme, setTheme } = useStore();

  // On mount, attempt to restore file system access from IndexedDB
  useEffect(() => {
    if (hasFileSystemAccess) return;

    const restore = async () => {
      const result = await fileSystemService.tryRestore();
      if (result === 'granted') {
        setHasFileSystemAccess(true);
        setSidebarOpen(true);
      }
      // 'prompt' case is handled by Home.tsx reconnect UI
    };
    restore();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  const cycleTheme = () => {
    const next = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
    setTheme(next);
  };

  const themeLabel = theme === 'auto' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark';

  return (
    <div className="layout">
      {sidebarOpen && <Sidebar />}
      <main className="main-content">
        <div className="top-bar">
          {!sidebarOpen && (
            <button className="btn-icon" onClick={() => setSidebarOpen(true)} title="Open sidebar">
              ☰
            </button>
          )}
          <Link to="/" className="home-button">
            <span className="material-symbols-outlined">home</span>
            HOME
          </Link>
          <div className="top-bar-spacer" />
          <Link to="/settings" className="settings-button" title="Settings">
            <span className="material-symbols-outlined">settings</span>
          </Link>
          <button className="theme-toggle" onClick={cycleTheme} title={`Theme: ${themeLabel}`}>
            <span className="material-symbols-outlined">
              {theme === 'dark' ? 'dark_mode' : theme === 'light' ? 'light_mode' : 'brightness_auto'}
            </span>
            <span className="theme-label">{themeLabel}</span>
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
