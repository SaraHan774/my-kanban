import { useStore } from '@/store/useStore';
import { fileSystemService } from '@/services';
import './Home.css';

export function Home() {
  const { hasFileSystemAccess, setHasFileSystemAccess, setSidebarOpen } = useStore();

  const handleSelectFolder = async () => {
    try {
      await fileSystemService.requestDirectoryAccess();
      setHasFileSystemAccess(true);
      setSidebarOpen(true);
    } catch (error) {
      console.error('Failed to access file system:', error);
      alert('Failed to access folder. Please try again.');
    }
  };

  if (!hasFileSystemAccess) {
    return (
      <div className="home">
        <div className="welcome-card">
          <h1>Welcome to My Kanban</h1>
          <p className="welcome-text">
            A local, file-based Kanban board with Notion-like pages.
            All your data is stored locally and can be tracked with git.
          </p>

          <div className="features">
            <div className="feature">
              <span className="feature-icon">📝</span>
              <h3>Markdown Notes</h3>
              <p>Write notes with full markdown syntax support</p>
            </div>
            <div className="feature">
              <span className="feature-icon">📋</span>
              <h3>Kanban Boards</h3>
              <p>Organize tasks with customizable columns</p>
            </div>
            <div className="feature">
              <span className="feature-icon">🏷️</span>
              <h3>Tag System</h3>
              <p>Categorize and filter your pages</p>
            </div>
            <div className="feature">
              <span className="feature-icon">⏱️</span>
              <h3>Pomodoro Timer</h3>
              <p>Track time spent on each page</p>
            </div>
          </div>

          <button onClick={handleSelectFolder} className="btn btn-primary btn-large">
            Select Workspace Folder
          </button>

          <p className="help-text">
            Choose a folder where your workspace will be stored.
            The app will create a "workspace" subfolder to organize your pages.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="home">
      <div className="home-content">
        <h1>My Kanban</h1>
        <p>Select a page from the sidebar or create a new one.</p>
      </div>
    </div>
  );
}
