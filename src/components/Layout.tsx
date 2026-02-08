import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useStore } from '@/store/useStore';
import './Layout.css';

export function Layout() {
  const { sidebarOpen } = useStore();

  return (
    <div className="layout">
      {sidebarOpen && <Sidebar />}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
