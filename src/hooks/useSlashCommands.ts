import { useState, useCallback, useRef, MutableRefObject } from 'react';
import { Editor } from '@tiptap/core';
import { EditorView } from '@tiptap/pm/view';
import { AppSlashCommand } from '@/data/defaultSlashCommands';

interface SlashCommandState {
  show: boolean;
  query: string;
  position: { from: number; to: number } | null;
  selectedIndex: number;
  palettePos: { top: number; left: number };
}

const INITIAL_STATE: SlashCommandState = {
  show: false,
  query: '',
  position: null,
  selectedIndex: 0,
  palettePos: { top: 0, left: 0 },
};

export function useSlashCommands(
  slashCommands: AppSlashCommand[],
  editorRef: MutableRefObject<Editor | null>,
) {
  const [state, setState] = useState<SlashCommandState>(INITIAL_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  const filteredCommands = slashCommands.filter(
    (cmd) =>
      cmd.key.toLowerCase().includes(state.query.toLowerCase()) ||
      cmd.label.toLowerCase().includes(state.query.toLowerCase()),
  );

  const execute = useCallback((cmd: AppSlashCommand) => {
    const editor = editorRef.current;
    const { position } = stateRef.current;
    if (!editor || !position) return;

    const { from, to } = position;

    if (cmd.action) {
      editor.chain().focus().deleteRange({ from, to }).run();
      cmd.action(editor);
    } else {
      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .insertContent(cmd.insert)
        .run();

      if (cmd.cursorOffset) {
        editor.commands.setTextSelection(from + cmd.insert.length - cmd.cursorOffset);
      }
    }

    setState(INITIAL_STATE);
  }, [editorRef]);

  const handleKeyDown = useCallback(
    (view: EditorView, event: KeyboardEvent): boolean => {
      const s = stateRef.current;

      if (s.show) {
        const cmds = slashCommands.filter(
          (cmd) =>
            cmd.key.toLowerCase().includes(s.query.toLowerCase()) ||
            cmd.label.toLowerCase().includes(s.query.toLowerCase()),
        );

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setState((prev) => ({ ...prev, selectedIndex: (prev.selectedIndex + 1) % cmds.length }));
          return true;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setState((prev) => ({
            ...prev,
            selectedIndex: (prev.selectedIndex - 1 + cmds.length) % cmds.length,
          }));
          return true;
        }
        if (event.key === 'Enter' && cmds.length > 0) {
          event.preventDefault();
          execute(cmds[s.selectedIndex]);
          return true;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          setState(INITIAL_STATE);
          return true;
        }
      }

      if (event.key === '/') {
        const { selection } = view.state;
        const { $from } = selection;
        const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\n', '\n');
        if (textBefore.match(/(?:^|\s)$/)) {
          setTimeout(() => {
            const pos = view.state.selection.from;
            const coords = view.coordsAtPos(pos);
            setState({
              show: true,
              query: '',
              position: { from: pos - 1, to: pos },
              selectedIndex: 0,
              palettePos: { top: coords.bottom, left: coords.left },
            });
          }, 0);
        }
      }

      return false;
    },
    [slashCommands, execute],
  );

  const handleEditorUpdate = useCallback(() => {
    const editor = editorRef.current;
    const s = stateRef.current;
    if (!editor || !s.show || !s.position) return;

    const { from } = editor.state.selection;
    const text = editor.state.doc.textBetween(s.position.from, from);

    if (!text.startsWith('/')) {
      setState(INITIAL_STATE);
      return;
    }

    const query = text.slice(1);
    if (query.includes(' ') || query.includes('\n')) {
      setState(INITIAL_STATE);
    } else {
      setState((prev) => ({
        ...prev,
        query,
        position: { from: prev.position!.from, to: from },
        selectedIndex: 0,
      }));
    }
  }, [editorRef]);

  return {
    show: state.show,
    selectedIndex: state.selectedIndex,
    palettePos: state.palettePos,
    filteredCommands,
    execute,
    handleKeyDown,
    handleEditorUpdate,
  };
}
