import { useState, useCallback, useEffect, useRef } from 'react';
import { Page, Memo } from '@/types';
import { pageService } from '@/services';

interface UseMemoManagerOptions {
  page: Page | null;
  onUpdate: (page: Page) => void;
  onToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function useMemoManager({ page, onUpdate, onToast }: UseMemoManagerOptions) {
  const [memoMode, setMemoMode] = useState(false);
  const [memoPanelWidth, setMemoPanelWidth] = useState(400);
  const [lastCreatedMemoId, setLastCreatedMemoId] = useState<string | null>(null);

  const isResizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);

  // Auto-clear lastCreatedMemoId after delay
  useEffect(() => {
    if (lastCreatedMemoId) {
      const timer = setTimeout(() => {
        setLastCreatedMemoId(null);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [lastCreatedMemoId]);

  const handleCreateMemo = useCallback(async () => {
    if (!page) return;

    const newMemoId = crypto.randomUUID();
    const newMemo: Memo = {
      id: newMemoId,
      type: 'independent',
      note: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      order: (page.memos || []).length,
    };

    const updatedPage = {
      ...page,
      memos: [...(page.memos || []), newMemo],
      updatedAt: new Date().toISOString(),
    };

    onUpdate(updatedPage);
    setLastCreatedMemoId(newMemoId);

    try {
      await pageService.updatePage(updatedPage);
    } catch (err) {
      console.error('Failed to save memo:', err);
      onToast('Failed to save memo', 'error');
    }
  }, [page, onUpdate, onToast]);

  const handleUpdateMemo = useCallback(async (memoId: string, note: string) => {
    if (!page) return;

    const updatedMemos = (page.memos || []).map(m =>
      m.id === memoId ? { ...m, note, updatedAt: new Date().toISOString() } : m
    );

    const updatedPage = {
      ...page,
      memos: updatedMemos,
      updatedAt: new Date().toISOString(),
    };

    onUpdate(updatedPage);

    try {
      await pageService.updatePage(updatedPage);
    } catch (err) {
      console.error('Failed to update memo:', err);
      onToast('Failed to update memo', 'error');
    }
  }, [page, onUpdate, onToast]);

  const handleDeleteMemo = useCallback(async (memoId: string) => {
    if (!page) return;

    const updatedMemos = (page.memos || []).filter(m => m.id !== memoId);

    const updatedPage = {
      ...page,
      memos: updatedMemos,
      updatedAt: new Date().toISOString(),
    };

    onUpdate(updatedPage);

    try {
      await pageService.updatePage(updatedPage);
    } catch (err) {
      console.error('Failed to delete memo:', err);
      onToast('Failed to delete memo', 'error');
    }
  }, [page, onUpdate, onToast]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    isResizingRef.current = true;
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = memoPanelWidth;
    e.preventDefault();
  }, [memoPanelWidth]);

  // Handle resize drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;

      const deltaX = resizeStartXRef.current - e.clientX;
      const newWidth = resizeStartWidthRef.current + deltaX;
      const maxWidth = window.innerWidth * 0.5;
      const minWidth = 360;
      const constrainedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
      setMemoPanelWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
    };

    if (memoMode) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [memoMode]);

  return {
    memoMode,
    setMemoMode,
    memoPanelWidth,
    lastCreatedMemoId,
    handleCreateMemo,
    handleUpdateMemo,
    handleDeleteMemo,
    handleResizeStart,
  };
}
