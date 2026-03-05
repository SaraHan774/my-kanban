import { useState, useCallback, useRef } from 'react';
import { Editor } from '@tiptap/core';
import { extractHighlights } from '@/lib/tiptap/utils/highlightSerialization';

export function useHighlightManager() {
  const [highlightsVisible, setHighlightsVisible] = useState(true);
  const editorRef = useRef<Editor | null>(null);

  /**
   * Called when editor is ready.
   * No migration needed here — file-level migration in pageService.loadPage()
   * handles inserting <mark> tags before content reaches the editor.
   */
  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  const extractCurrentHighlights = useCallback(() => {
    if (!editorRef.current || editorRef.current.isDestroyed) return [];
    try {
      return extractHighlights(editorRef.current);
    } catch (error) {
      console.error('Failed to extract highlights:', error);
      return [];
    }
  }, []);

  const toggleHighlightsVisibility = useCallback(() => {
    setHighlightsVisible(prev => !prev);
  }, []);

  return {
    highlightsVisible,
    editorRef,
    handleEditorReady,
    extractCurrentHighlights,
    toggleHighlightsVisibility,
  };
}
