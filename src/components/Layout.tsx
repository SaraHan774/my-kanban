import { useEffect, useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useStore } from '@/store/useStore';
import { fileSystemService } from '@/services';
import './Layout.css';

type Theme = 'light' | 'dark' | 'auto';

export function Layout() {
  const { sidebarOpen, setSidebarOpen, hasFileSystemAccess, setHasFileSystemAccess } = useStore();
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('kanban-theme') as Theme) || 'auto';
  });

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
    localStorage.setItem('kanban-theme', theme);
  }, [theme]);

  const cycleTheme = () => {
    setTheme(prev => {
      if (prev === 'auto') return 'light';
      if (prev === 'light') return 'dark';
      return 'auto';
    });
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
