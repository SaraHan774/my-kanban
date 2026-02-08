import { useState, useCallback, useMemo, useRef, ChangeEvent, KeyboardEvent, RefObject } from 'react';
import { SlashCommand } from './types';

interface UseSlashCommandsOptions {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  content: string;
  setContent: (s: string) => void;
  commands: SlashCommand[];
  onExecute?: (cmd: SlashCommand) => void;
}

interface UseSlashCommandsReturn {
  // State
  isOpen: boolean;
  filteredCommands: SlashCommand[];
  selectedIndex: number;

  // Convenience API — wire directly to textarea
  handleChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleCompositionStart: () => void;
  handleCompositionEnd: () => void;
  handleBlur: () => void;

  // Low-level API — when the app manages setContent itself
  notifyContentChange: (content: string, cursorPos: number) => void;

  // Actions
  executeCommand: (cmd: SlashCommand) => void;
  closePalette: () => void;
}

export function useSlashCommands({
  textareaRef,
  content,
  setContent,
  commands,
  onExecute,
}: UseSlashCommandsOptions): UseSlashCommandsReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const isComposing = useRef(false);
  const slashStartPos = useRef<number | null>(null);

  const filteredCommands = useMemo(() => {
    if (!isOpen) return [];
    const q = query.toLowerCase();
    return commands.filter(
      (cmd) => cmd.key.toLowerCase().includes(q) || cmd.label.toLowerCase().includes(q)
    );
  }, [isOpen, query, commands]);

  const closePalette = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    slashStartPos.current = null;
  }, []);

  const checkSlashTrigger = useCallback(
    (text: string, cursorPos: number) => {
      if (isComposing.current) return;

      const textBeforeCursor = text.slice(0, cursorPos);

      if (slashStartPos.current !== null) {
        // Already tracking a slash — update query or close
        const slashPos = slashStartPos.current;

        if (
          slashPos >= cursorPos ||
          text[slashPos] !== '/'
        ) {
          // Slash was deleted or cursor moved before it
          closePalette();
          return;
        }

        const afterSlash = textBeforeCursor.slice(slashPos + 1);

        if (afterSlash.includes(' ') || afterSlash.includes('\n')) {
          // Space or newline after slash query — close
          closePalette();
          return;
        }

        setQuery(afterSlash);
        setSelectedIndex(0);
        if (!isOpen) setIsOpen(true);
        return;
      }

      // Not tracking — check if we should open
      if (cursorPos === 0 || text[cursorPos - 1] !== '/') return;

      const slashPos = cursorPos - 1;

      // Must be at line start or preceded by whitespace
      if (slashPos > 0) {
        const charBefore = text[slashPos - 1];
        if (charBefore !== '\n' && charBefore !== ' ' && charBefore !== '\t') return;
      }

      slashStartPos.current = slashPos;
      setIsOpen(true);
      setQuery('');
      setSelectedIndex(0);
    },
    [isOpen, closePalette]
  );

  const executeCommand = useCallback(
    (cmd: SlashCommand) => {
      const textarea = textareaRef.current;
      if (!textarea || slashStartPos.current === null) return;

      const start = slashStartPos.current;
      const cursorPos = textarea.selectionStart;

      // Replace /query with the command's insert text
      const before = content.slice(0, start);
      const after = content.slice(cursorPos);
      const newContent = before + cmd.insert + after;

      setContent(newContent);

      // Calculate cursor position
      const newCursorPos =
        cmd.cursorOffset !== undefined
          ? start + cmd.insert.length - cmd.cursorOffset
          : start + cmd.insert.length;

      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      });

      // Close palette
      closePalette();
      onExecute?.(cmd);
    },
    [content, setContent, textareaRef, onExecute, closePalette]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      const cursorPos = e.target.selectionStart;
      setContent(value);
      checkSlashTrigger(value, cursorPos);
    },
    [setContent, checkSlashTrigger]
  );

  const notifyContentChange = useCallback(
    (newContent: string, cursorPos: number) => {
      checkSlashTrigger(newContent, cursorPos);
    },
    [checkSlashTrigger]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!isOpen || filteredCommands.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
          break;
        case 'Enter':
          e.preventDefault();
          executeCommand(filteredCommands[selectedIndex]);
          break;
        case 'Tab':
          e.preventDefault();
          executeCommand(filteredCommands[selectedIndex]);
          break;
        case 'Escape':
          e.preventDefault();
          closePalette();
          break;
      }
    },
    [isOpen, filteredCommands, selectedIndex, executeCommand, closePalette]
  );

  const handleCompositionStart = useCallback(() => {
    isComposing.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposing.current = false;
  }, []);

  const handleBlur = useCallback(() => {
    closePalette();
  }, [closePalette]);

  return {
    isOpen,
    filteredCommands,
    selectedIndex,
    handleChange,
    handleKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
    handleBlur,
    notifyContentChange,
    executeCommand,
    closePalette,
  };
}
