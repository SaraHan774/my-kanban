import { RefObject, useCallback, KeyboardEvent } from 'react';

function toggleWrap(
  textarea: HTMLTextAreaElement,
  content: string,
  setContent: (s: string) => void,
  marker: string
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = content.slice(start, end);
  const len = marker.length;

  // Check if already wrapped
  const before = content.slice(Math.max(0, start - len), start);
  const after = content.slice(end, end + len);

  if (before === marker && after === marker) {
    // Remove wrapping
    const newContent = content.slice(0, start - len) + selected + content.slice(end + len);
    setContent(newContent);
    requestAnimationFrame(() => {
      textarea.setSelectionRange(start - len, end - len);
      textarea.focus();
    });
  } else if (selected) {
    // Wrap selection
    const newContent = content.slice(0, start) + marker + selected + marker + content.slice(end);
    setContent(newContent);
    requestAnimationFrame(() => {
      textarea.setSelectionRange(start + len, end + len);
      textarea.focus();
    });
  } else {
    // No selection: insert markers and place cursor between
    const newContent = content.slice(0, start) + marker + marker + content.slice(end);
    setContent(newContent);
    requestAnimationFrame(() => {
      textarea.setSelectionRange(start + len, start + len);
      textarea.focus();
    });
  }
}

export function useMarkdownShortcuts(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  content: string,
  setContent: (s: string) => void
) {
  const handleMarkdownShortcut = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!(e.metaKey || e.ctrlKey)) return false;
      const textarea = textareaRef.current;
      if (!textarea) return false;

      switch (e.key) {
        case 'b':
          e.preventDefault();
          toggleWrap(textarea, content, setContent, '**');
          return true;
        case 'i':
          e.preventDefault();
          toggleWrap(textarea, content, setContent, '*');
          return true;
        case 'e':
          e.preventDefault();
          toggleWrap(textarea, content, setContent, '`');
          return true;
        default:
          return false;
      }
    },
    [textareaRef, content, setContent]
  );

  return { handleMarkdownShortcut };
}
