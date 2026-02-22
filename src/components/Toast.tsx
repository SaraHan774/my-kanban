import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import './Toast.css';

export function Toast() {
  const { toast, hideToast } = useStore();

  useEffect(() => {
    if (!toast) return;

    // Allow manual dismissal with Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hideToast();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [toast, hideToast]);

  if (!toast) return null;

  return (
    <div className={`toast toast-${toast.type}`} onClick={hideToast}>
      <div className="toast-content">
        <span className="toast-icon">
          {toast.type === 'success' && '✓'}
          {toast.type === 'error' && '✕'}
          {toast.type === 'info' && 'ℹ'}
        </span>
        <span className="toast-message">{toast.message}</span>
      </div>
    </div>
  );
}
