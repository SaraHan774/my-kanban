import { useState, useCallback, useEffect, useRef } from 'react';
import { Page } from '@/types';
import { pageService, markdownService } from '@/services';
import { useStore } from '@/store/useStore';
import { useSlashCommands, SlashCommandPalette } from '@/lib/slash-commands';
import { useMarkdownShortcuts } from '@/hooks/useMarkdownShortcuts';
import './PageEditor.css';

interface PageEditorProps {
  page: Page;
  onSave: (updatedPage: Page) => void;
  onCancel: () => void;
}

export function PageEditor({ page, onSave, onCancel }: PageEditorProps) {
  const { updatePageInStore, pages, slashCommands, columnColors } = useStore();
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [tags, setTags] = useState(page.tags.join(', '));
  const [dueDate, setDueDate] = useState(page.dueDate ? page.dueDate.slice(0, 10) : '');
  const [selectedColumn, setSelectedColumn] = useState(page.kanbanColumn || '');
  const [newColumnInput, setNewColumnInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showToast, setShowToast] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const slash = useSlashCommands({
    textareaRef,
    content,
    setContent,
    commands: slashCommands,
  });

  const markdown = useMarkdownShortcuts(textareaRef, content, setContent);

  // Derive existing columns from all pages' kanbanColumn values (case-insensitive dedup)
  const existingColumns = Array.from(
    pages.map(p => p.kanbanColumn).filter(Boolean).reduce((map, col) => {
      const key = (col as string).toLowerCase();
      if (!map.has(key)) map.set(key, col as string);
      return map;
    }, new Map<string, string>()).values()
  );

  const getColColor = (col: string) => columnColors[col.toLowerCase()];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePreview = useCallback(async () => {
    if (!preview) {
      const html = await markdownService.toHtml(content);
      setPreviewHtml(html);
    }
    setPreview(!preview);
  }, [preview, content]);

  const handleAddNewColumn = () => {
    const trimmed = newColumnInput.trim();
    if (!trimmed) return;
    setSelectedColumn(trimmed);
    setNewColumnInput('');
    setShowDropdown(false);
  };

  const handleNewColumnKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNewColumn();
    }
  };

  // Handle Tab indent, markdown shortcuts, and other keyboard shortcuts
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle markdown shortcuts (Cmd+B, Cmd+I, Cmd+E) first
    if (markdown.handleMarkdownShortcut(e)) return;

    // Handle Escape key (only when slash palette is not open)
    if (e.key === 'Escape' && !slash.isOpen) {
      e.preventDefault();
      onCancel();
      return;
    }

    // Handle Tab indent when slash palette is NOT open
    if (e.key === 'Tab' && !slash.isOpen) {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const hasSelection = start !== end;

      if (hasSelection) {
        // Multi-line indent/dedent
        const beforeSelection = content.substring(0, start);
        const selectedText = content.substring(start, end);
        const afterSelection = content.substring(end);

        // Find start of first selected line
        const lineStart = beforeSelection.lastIndexOf('\n') + 1;
        const lineEnd = end;

        // Get all lines in selection
        const textToProcess = content.substring(lineStart, lineEnd);
        const lines = textToProcess.split('\n');

        if (e.shiftKey) {
          // Shift+Tab: dedent (remove up to 2 leading spaces from each line)
          const dedentedLines = lines.map(line => {
            if (line.startsWith('  ')) return line.substring(2);
            if (line.startsWith(' ')) return line.substring(1);
            return line;
          });
          const newText = dedentedLines.join('\n');
          const newContent = content.substring(0, lineStart) + newText + afterSelection;
          setContent(newContent);

          // Restore selection
          setTimeout(() => {
            textarea.focus();
            const newStart = start - (lineStart === start ? Math.min(2, lines[0].length - dedentedLines[0].length) : 0);
            const lengthDiff = textToProcess.length - newText.length;
            textarea.setSelectionRange(newStart, end - lengthDiff);
          }, 0);
        } else {
          // Tab: indent (add 2 spaces to each line)
          const indentedLines = lines.map(line => '  ' + line);
          const newText = indentedLines.join('\n');
          const newContent = content.substring(0, lineStart) + newText + afterSelection;
          setContent(newContent);

          // Restore selection
          setTimeout(() => {
            textarea.focus();
            const spacesAdded = lines.length * 2;
            const newStart = start + (lineStart === start ? 2 : 0);
            textarea.setSelectionRange(newStart, end + spacesAdded);
          }, 0);
        }
      } else if (e.shiftKey) {
        // Shift+Tab: dedent current line (remove up to 2 leading spaces)
        const beforeCursor = content.substring(0, start);
        const afterCursor = content.substring(start);
        const lineStart = beforeCursor.lastIndexOf('\n') + 1;
        const lineEnd = content.indexOf('\n', start);
        const currentLine = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);

        if (currentLine.startsWith('  ')) {
          const newLine = currentLine.substring(2);
          const newContent = content.substring(0, lineStart) + newLine + (lineEnd === -1 ? '' : content.substring(lineEnd));
          setContent(newContent);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(Math.max(lineStart, start - 2), Math.max(lineStart, start - 2));
          }, 0);
        } else if (currentLine.startsWith(' ')) {
          const newLine = currentLine.substring(1);
          const newContent = content.substring(0, lineStart) + newLine + (lineEnd === -1 ? '' : content.substring(lineEnd));
          setContent(newContent);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(Math.max(lineStart, start - 1), Math.max(lineStart, start - 1));
          }, 0);
        }
      } else {
        // Tab: insert 2 spaces at cursor
        const newContent = content.substring(0, start) + '  ' + content.substring(end);
        setContent(newContent);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + 2, start + 2);
        }, 0);
      }
      return;
    }

    // Delegate to slash commands handler
    slash.handleKeyDown(e);
  };

  // Keyboard shortcut: Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [title, content, tags, dueDate, selectedColumn]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      const updatedPage: Page = {
        ...page,
        title: title.trim() || page.title,
        content,
        tags: tagList,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        kanbanColumn: selectedColumn || undefined,
      };

      await pageService.updatePage(updatedPage);
      updatePageInStore(updatedPage);
      onSave(updatedPage);

      // Show success toast
      console.log('Showing toast...');
      setShowToast(true);
      setTimeout(() => {
        console.log('Hiding toast...');
        setShowToast(false);
      }, 3000);
    } catch (error) {
      console.error('Failed to save page:', error);
      alert('Failed to save page. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {showToast && (
        <div className="toast-notification">
          <span className="material-symbols-outlined">check_circle</span>
          <span>Saved successfully!</span>
        </div>
      )}
      <div className="page-editor">
        <div className="editor-toolbar">
        <div className="editor-toolbar-left">
          <button
            className={`toolbar-btn ${!preview ? 'active' : ''}`}
            onClick={() => setPreview(false)}
          >
            Edit
          </button>
          <button
            className={`toolbar-btn ${preview ? 'active' : ''}`}
            onClick={handlePreview}
          >
            Preview
          </button>
        </div>
        <div className="editor-toolbar-right">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="editor-meta">
        <div className="editor-field">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="editor-title-input"
            placeholder="Untitled"
          />
        </div>
        <div className="editor-field-row">
          <div className="editor-field">
            <label>Column</label>
            <div className="column-selector" ref={dropdownRef}>
              <div
                className="column-selector-display"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                {selectedColumn ? (
                  <span
                    className="selected-column-chip"
                    style={getColColor(selectedColumn) ? { backgroundColor: getColColor(selectedColumn) } : undefined}
                  >
                    {selectedColumn}
                    <button
                      type="button"
                      className="chip-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedColumn('');
                      }}
                    >
                      ✕
                    </button>
                  </span>
                ) : (
                  <span className="column-placeholder">Column...</span>
                )}
              </div>

              {showDropdown && (
                <div className="column-dropdown">
                  {existingColumns.length > 0 && (
                    <div className="column-chips">
                      {existingColumns.map(col => (
                        <button
                          key={col}
                          type="button"
                          className={`column-chip ${selectedColumn === col ? 'active' : ''}`}
                          style={getColColor(col)
                            ? selectedColumn === col
                              ? { backgroundColor: getColColor(col), color: 'white', borderColor: 'transparent' }
                              : { borderColor: getColColor(col), color: getColColor(col) }
                            : undefined}
                          onClick={() => {
                            setSelectedColumn(col);
                            setShowDropdown(false);
                          }}
                        >
                          {col}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="column-new-input">
                    <input
                      type="text"
                      value={newColumnInput}
                      onChange={e => setNewColumnInput(e.target.value)}
                      onKeyDown={handleNewColumnKeyDown}
                      placeholder="New column..."
                    />
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={handleAddNewColumn}
                      disabled={!newColumnInput.trim()}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="editor-field">
            <label>Tags</label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="comma-separated"
            />
          </div>
          <div className="editor-field">
            <label>Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {preview ? (
        <div
          className="editor-preview markdown-content"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      ) : (
        <div className="editor-textarea-wrapper">
          {slash.isOpen && slash.palettePosition && (
            <SlashCommandPalette
              commands={slash.filteredCommands}
              selectedIndex={slash.selectedIndex}
              position={slash.palettePosition}
              onSelect={slash.executeCommand}
              onClose={slash.closePalette}
            />
          )}
          <textarea
            ref={textareaRef}
            className="editor-textarea"
            value={content}
            onChange={slash.handleChange}
            onKeyDown={handleEditorKeyDown}
            onCompositionStart={slash.handleCompositionStart}
            onCompositionEnd={slash.handleCompositionEnd}
            onBlur={slash.handleBlur}
            placeholder="Type / for commands, or start writing..."
            spellCheck
          />
        </div>
      )}
      </div>
    </>
  );
}
