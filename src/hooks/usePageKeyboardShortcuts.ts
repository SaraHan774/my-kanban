import { useEffect } from 'react';

interface UsePageKeyboardShortcutsOptions {
  onSave: () => void;
  onToggleFindBar: () => void;
  onToggleToc: () => void;
  onToggleMemoMode: () => void;
  onCreateMemo: () => void;
  onToggleImmerseMode: () => void;
  isImmerseMode: boolean;
  memoMode: boolean;
}

export function usePageKeyboardShortcuts({
  onSave,
  onToggleFindBar,
  onToggleToc,
  onToggleMemoMode,
  onCreateMemo,
  onToggleImmerseMode,
  isImmerseMode,
  memoMode,
}: UsePageKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc to exit immerse mode
      if (e.key === 'Escape' && isImmerseMode) {
        e.preventDefault();
        onToggleImmerseMode();
        return;
      }

      // Cmd+Shift+I for immerse mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'i') {
        e.preventDefault();
        onToggleImmerseMode();
        return;
      }

      // Don't process other shortcuts in immerse mode
      if (isImmerseMode) return;

      // Cmd+S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onSave();
        return;
      }

      // Cmd+F for find
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        onToggleFindBar();
        return;
      }

      // Cmd+Shift+T for ToC toggle
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 't') {
        e.preventDefault();
        onToggleToc();
        return;
      }

      // Cmd+Shift+M for creating a new memo
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'm') {
        e.preventDefault();
        if (!memoMode) onToggleMemoMode();
        onCreateMemo();
        return;
      }

      // Cmd+M for memo mode toggle
      if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
        e.preventDefault();
        onToggleMemoMode();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onSave,
    onToggleFindBar,
    onToggleToc,
    onToggleMemoMode,
    onCreateMemo,
    onToggleImmerseMode,
    isImmerseMode,
    memoMode,
  ]);
}
