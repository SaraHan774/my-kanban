import { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { PageView } from './pages/PageView';
import { Settings } from './pages/Settings';
import { Layout } from './components/Layout';
import { InstallPrompt } from './components/InstallPrompt';
import { useStore } from './store/useStore';
import { gitService } from './services/gitService';
import './styles/global.css';
import 'highlight.js/styles/github-dark.css';

function App() {
  const { git: gitSettings } = useStore();

  // Initialize auto-commit based on settings
  useEffect(() => {
    const initAutoCommit = async () => {
      // Check if Git is enabled and auto-commit is enabled
      if (gitSettings.enabled && gitSettings.autoCommit) {
        try {
          // Check if workspace is a Git repository
          const isRepo = await gitService.isRepository();
          if (isRepo) {
            // Start auto-commit with configured interval
            const commitOptions = {
              author_name: gitSettings.userName || 'User',
              author_email: gitSettings.userEmail || 'user@example.com',
              message: '', // Will be overridden by gitService with timestamp
            };
            gitService.startAutoCommit(gitSettings.autoCommitInterval, commitOptions);
          }
        } catch (error) {
          console.error('Failed to initialize auto-commit:', error);
        }
      } else {
        // Stop auto-commit if disabled
        gitService.stopAutoCommit();
      }
    };

    initAutoCommit();

    // Cleanup: stop auto-commit when app unmounts
    return () => {
      gitService.stopAutoCommit();
    };
  }, [gitSettings.enabled, gitSettings.autoCommit, gitSettings.autoCommitInterval, gitSettings.userName, gitSettings.userEmail]);

  return (
    <HashRouter>
      <InstallPrompt />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="/page/:pageId" element={<PageView />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
