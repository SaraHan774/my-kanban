import { useState, useEffect } from 'react';
import './InstallPrompt.css';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowPrompt(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember dismissal for 7 days
    localStorage.setItem('install-prompt-dismissed', Date.now().toString());
  };

  // Check if user dismissed recently
  useEffect(() => {
    const dismissed = localStorage.getItem('install-prompt-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < sevenDays) {
        setShowPrompt(false);
      }
    }
  }, []);

  if (!showPrompt || !deferredPrompt) return null;

  return (
    <div className="install-prompt">
      <div className="install-prompt-content">
        <div className="install-prompt-icon">💾</div>
        <div className="install-prompt-text">
          <h3>Install Kanban Board</h3>
          <p>Install this app on your desktop for quick access and offline use</p>
        </div>
        <div className="install-prompt-actions">
          <button onClick={handleInstall} className="btn btn-primary btn-small">
            Install
          </button>
          <button onClick={handleDismiss} className="btn btn-secondary btn-small">
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
}
