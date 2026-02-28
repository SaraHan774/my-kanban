import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { gitService, GitStatus, GitCommitOptions } from '@/services/gitService';
import { useStore } from '@/store/useStore';
import './GitModal.css';

interface GitModalProps {
  onClose: () => void;
  initialStatus: GitStatus | null;
  onStatusUpdate: (status: GitStatus) => void;
}

export function GitModal({ onClose, initialStatus, onStatusUpdate }: GitModalProps) {
  const { showToast, git: gitSettings } = useStore();
  const [status, setStatus] = useState<GitStatus | null>(initialStatus);
  const [commitMessage, setCommitMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [operation, setOperation] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    // Fetch fresh status on mount
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const newStatus = await gitService.getStatus();
      setStatus(newStatus);
      onStatusUpdate(newStatus);
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  };

  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!commitMessage.trim()) {
      setError('Commit message is required');
      return;
    }

    setLoading(true);
    setOperation('Committing...');
    setError('');

    try {
      const options: GitCommitOptions = {
        message: commitMessage,
        author_name: gitSettings.userName || 'User',
        author_email: gitSettings.userEmail || 'user@example.com',
      };

      await gitService.commit(options);
      setCommitMessage('');
      await fetchStatus();
      showToast('Changes committed successfully', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      showToast('Commit failed', 'error');
    } finally {
      setLoading(false);
      setOperation('');
    }
  };

  const handleSync = async () => {
    setLoading(true);
    setOperation('Syncing...');
    setError('');

    try {
      // Add 60 second timeout for sync (pull + push)
      const syncPromise = gitService.sync(gitSettings.remoteName || 'origin');
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Sync timed out after 60 seconds. Check your SSH keys and network connection.')), 60000)
      );

      await Promise.race([syncPromise, timeoutPromise]);
      await fetchStatus();
      showToast('Synced successfully', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      showToast('Sync failed', 'error');
    } finally {
      setLoading(false);
      setOperation('');
    }
  };

  const handlePush = async () => {
    setLoading(true);
    setOperation('Pushing...');
    setError('');

    try {
      console.log('GitModal: Starting push...', {
        remoteName: gitSettings.remoteName || 'origin',
        remoteUrl: gitSettings.remoteUrl,
        branch: status?.branch || 'unknown',
      });

      // Add 30 second timeout
      const pushPromise = gitService.push(gitSettings.remoteName || 'origin');
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Push timed out after 30 seconds. Check your SSH keys and network connection.')), 30000)
      );

      await Promise.race([pushPromise, timeoutPromise]);
      await fetchStatus();
      showToast('Pushed successfully', 'success');
      console.log('GitModal: Push successful');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('GitModal: Push failed:', {
        error: message,
        remoteName: gitSettings.remoteName,
        remoteUrl: gitSettings.remoteUrl,
        branch: status?.branch,
      });
      setError(message);
      showToast('Push failed', 'error');
    } finally {
      setLoading(false);
      setOperation('');
    }
  };

  const handlePull = async () => {
    setLoading(true);
    setOperation('Pulling...');
    setError('');

    try {
      // Add 30 second timeout
      const pullPromise = gitService.pull(gitSettings.remoteName || 'origin');
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Pull timed out after 30 seconds. Check your SSH keys and network connection.')), 30000)
      );

      await Promise.race([pullPromise, timeoutPromise]);
      await fetchStatus();
      showToast('Pulled successfully', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      showToast('Pull failed', 'error');
    } finally {
      setLoading(false);
      setOperation('');
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const totalChanges = (status?.modified_count || 0) + (status?.staged_count || 0);
  const hasChanges = totalChanges > 0;

  const modal = (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="git-modal" onClick={(e) => e.stopPropagation()}>
        <div className="git-modal-header">
          <h2>Git</h2>
          <button className="git-close-btn" onClick={onClose} disabled={loading}>
            ✕
          </button>
        </div>

        <div className="git-modal-content">
          {/* Status */}
          {status && (
            <div className="git-status">
              <div className="git-status-item">
                <span className="git-label">Branch</span>
                <span className="git-value">{status.branch}</span>
              </div>

              {totalChanges > 0 && (
                <div className="git-status-item">
                  <span className="git-label">Changes</span>
                  <span className="git-value git-changes">
                    {status.modified_count > 0 && (
                      <span>{status.modified_count} modified</span>
                    )}
                    {status.staged_count > 0 && (
                      <span>{status.staged_count} staged</span>
                    )}
                  </span>
                </div>
              )}

              {(status.ahead > 0 || status.behind > 0) && (
                <div className="git-status-item">
                  <span className="git-label">Remote</span>
                  <span className="git-value git-remote">
                    {status.ahead > 0 && <span>↑ {status.ahead}</span>}
                    {status.behind > 0 && <span>↓ {status.behind}</span>}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Commit */}
          {hasChanges && (
            <>
              <div className="git-divider" />
              <form onSubmit={handleCommit} className="git-commit-form">
                <input
                  ref={inputRef}
                  type="text"
                  className="git-input"
                  placeholder="Commit message..."
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="submit"
                  className="git-btn git-btn-primary"
                  disabled={loading || !commitMessage.trim()}
                >
                  {loading && operation === 'Committing...' ? 'Committing...' : 'Commit'}
                </button>
              </form>

              {status && status.modified_files.length > 0 && (
                <details className="git-files">
                  <summary>{status.modified_files.length} file{status.modified_files.length !== 1 ? 's' : ''} changed</summary>
                  <div className="git-files-list">
                    {status.modified_files.slice(0, 10).map((file, i) => (
                      <div key={i} className="git-file-item">{file}</div>
                    ))}
                    {status.modified_files.length > 10 && (
                      <div className="git-file-item git-file-more">
                        +{status.modified_files.length - 10} more
                      </div>
                    )}
                  </div>
                </details>
              )}
            </>
          )}

          {/* Remote Actions */}
          <div className="git-divider" />
          <div className="git-remote-section">
            {!gitSettings.remoteUrl ? (
              <p className="git-hint">
                Configure a remote URL in Settings to enable sync
              </p>
            ) : (
              <div className="git-actions">
                <button
                  className="git-btn"
                  onClick={handleSync}
                  disabled={loading}
                >
                  {loading && operation === 'Syncing...' ? 'Syncing...' : '↻ Sync'}
                </button>
                <button
                  className="git-btn"
                  onClick={handlePull}
                  disabled={loading}
                >
                  {loading && operation === 'Pulling...' ? 'Pulling...' : '↓ Pull'}
                </button>
                <button
                  className="git-btn"
                  onClick={handlePush}
                  disabled={loading}
                >
                  {loading && operation === 'Pushing...' ? 'Pushing...' : '↑ Push'}
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <>
              <div className="git-divider" />
              <div className="git-error">
                <div className="git-error-title">Error</div>
                <div className="git-error-message">{error}</div>
                {error.toLowerCase().includes('ssh') && (
                  <div className="git-error-hint">
                    Configure SSH keys for Git authentication
                  </div>
                )}
                {error.toLowerCase().includes('conflict') && (
                  <div className="git-error-hint">
                    Resolve merge conflicts in your terminal
                  </div>
                )}
                {error.toLowerCase().includes('repository not found') && (
                  <div className="git-error-hint">
                    The remote repository doesn't exist yet. Create it on GitHub first, then try again.
                  </div>
                )}
                {error.toLowerCase().includes('permission denied') && (
                  <div className="git-error-hint">
                    You don't have write access to this repository. Check your GitHub permissions.
                  </div>
                )}
                {error.toLowerCase().includes('fetch first') && (
                  <div className="git-error-hint">
                    The remote has changes you don't have. Click Pull to fetch changes first.
                  </div>
                )}
                {error.toLowerCase().includes('timeout') && (
                  <div className="git-error-hint">
                    The operation took too long. Check your network connection and SSH configuration.
                  </div>
                )}
              </div>
            </>
          )}

          {/* Loading */}
          {loading && (
            <div className="git-loading">
              <div className="git-spinner" />
              <span>{operation}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
