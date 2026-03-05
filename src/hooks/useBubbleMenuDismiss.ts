import { useEffect, useRef } from 'react';
import { Editor } from '@tiptap/core';

const DISMISS_DISTANCE = 200; // px

/**
 * Dismisses the BubbleMenu when the mouse moves far away from it.
 * Only activates after the mouse has entered the menu once (to avoid
 * premature dismissal during drag-select).
 */
export function useBubbleMenuDismiss(editor: Editor | null) {
  const menuRef = useRef<HTMLDivElement>(null);
  const enteredRef = useRef(false);

  useEffect(() => {
    if (!editor) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!enteredRef.current) return;
      const el = menuRef.current;
      if (!el) return;

      const { from, to } = editor.state.selection;
      if (from === to) {
        enteredRef.current = false;
        return;
      }

      const rect = el.getBoundingClientRect();
      const dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right);
      const dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom);
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > DISMISS_DISTANCE) {
        enteredRef.current = false;
        editor.commands.setTextSelection(editor.state.selection.from);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [editor]);

  const onMenuMouseEnter = () => { enteredRef.current = true; };

  return { menuRef, onMenuMouseEnter };
}
