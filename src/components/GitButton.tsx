import { useState, useEffect } from 'react';
import { gitService, GitStatus } from '@/services/gitService';
import { useStore } from '@/store/useStore';
import { GitModal } from './GitModal';
import './GitButton.css';

export function GitButton() {
  const { git: gitSettings } = useStore();
  const [isRepository, setIsRepository] = useState(false);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');

  // Check if we're in Tauri (desktop) mode
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  // Check if workspace is a Git repository
  useEffect(() => {
    if (!isTauri) {
      console.log('GitButton: Not in Tauri mode, Git features unavailable');
      return;
    }
    checkRepository();
  }, [isTauri]);

  // Re-check when settings change (e.g., after initialization)
  useEffect(() => {
    if (!isTauri) return;
    checkRepository();
  }, [gitSettings.userName, gitSettings.userEmail, gitSettings.remoteUrl, isTauri]);

  // Re-check periodically to catch initialization (stops when found or after 30 seconds)
  useEffect(() => {
    if (!isTauri || isRepository) return;

    console.log('GitButton: Starting periodic check (every 2s, max 30s)');
    let checkCount = 0;
    const maxChecks = 15; // 15 checks × 2 seconds = 30 seconds

    const interval = setInterval(() => {
      checkCount++;
      console.log(`GitButton: Repository check #${checkCount}/${maxChecks}`);
      checkRepository();

      if (checkCount >= maxChecks) {
        console.log('GitButton: Stopping periodic check (timeout reached)');
        clearInterval(interval);
      }
    }, 2000);

    return () => {
      console.log('GitButton: Cleaning up periodic check');
      clearInterval(interval);
    };
  }, [isTauri, isRepository]);

  // Poll status every 30 seconds when it's a repository
  useEffect(() => {
    if (!isRepository) return;

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);

    return () => clearInterval(interval);
  }, [isRepository]);

  const checkRepository = async () => {
    try {
      console.log('GitButton: Checking if workspace is a Git repository...');
      const isRepo = await gitService.isRepository();
      console.log('GitButton: Is repository?', isRepo);
      setIsRepository(isRepo);
    } catch (err) {
      console.error('GitButton: Failed to check repository:', err);
      setIsRepository(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const newStatus = await gitService.getStatus();
      setStatus(newStatus);
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  };

  const handleClick = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    // Refresh status after modal closes
    fetchStatus();
  };

  // Don't render if not in Tauri mode (Git is desktop-only)
  if (!isTauri) {
    return null;
  }

  // Don't render if not a repository
  if (!isRepository) {
    return null;
  }

  const totalChanges = (status?.modified_count || 0) + (status?.staged_count || 0);
  const hasChanges = totalChanges > 0;

  return (
    <>
      <button
        className="git-button"
        onClick={handleClick}
        title={status ? `${status.branch} - ${totalChanges} changes` : 'Git'}
      >
        {/* Git branch icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Top circle */}
          <circle cx="11" cy="3" r="2" fill="currentColor"/>
          {/* Bottom left circle */}
          <circle cx="4" cy="13" r="2" fill="currentColor"/>
          {/* Branch line */}
          <path
            d="M11 5C11 5 11 7 11 8C11 9.5 10 10.5 8.5 10.5C7 10.5 6 11.5 6 11.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          {/* Vertical line */}
          <line
            x1="4"
            y1="5"
            x2="4"
            y2="11"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        {hasChanges && (
          <span className="git-button-badge">{totalChanges}</span>
        )}
      </button>

      {showModal && (
        <GitModal
          onClose={handleCloseModal}
          initialStatus={status}
          onStatusUpdate={setStatus}
        />
      )}
    </>
  );
}
