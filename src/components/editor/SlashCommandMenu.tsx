import { useEffect, useState, useRef } from 'react';
import './SlashCommandMenu.css';

interface Command {
  id: string;
  label: string;
  description: string;
  icon?: string;
  action: () => void;
}

interface SlashCommandMenuProps {
  position: { top: number; left: number };
  onCommand: (command: string) => void;
  onClose: () => void;
}

export function SlashCommandMenu({ position, onCommand, onClose }: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const commands: Command[] = [
    {
      id: 'h1',
      label: 'Heading 1',
      description: 'Large section heading',
      icon: 'title',
      action: () => onCommand('# '),
    },
    {
      id: 'h2',
      label: 'Heading 2',
      description: 'Medium section heading',
      icon: 'title',
      action: () => onCommand('## '),
    },
    {
      id: 'h3',
      label: 'Heading 3',
      description: 'Small section heading',
      icon: 'title',
      action: () => onCommand('### '),
    },
    {
      id: 'todo',
      label: 'To-do List',
      description: 'Track tasks with checkboxes',
      icon: 'check_box',
      action: () => onCommand('- [ ] '),
    },
    {
      id: 'code',
      label: 'Code Block',
      description: 'Code with syntax highlighting',
      icon: 'code',
      action: () => onCommand('```\n\n```'),
    },
    {
      id: 'quote',
      label: 'Quote',
      description: 'Blockquote',
      icon: 'format_quote',
      action: () => onCommand('> '),
    },
    {
      id: 'ul',
      label: 'Bullet List',
      description: 'Unordered list',
      icon: 'format_list_bulleted',
      action: () => onCommand('- '),
    },
    {
      id: 'ol',
      label: 'Numbered List',
      description: 'Ordered list',
      icon: 'format_list_numbered',
      action: () => onCommand('1. '),
    },
    {
      id: 'table',
      label: 'Table',
      description: 'Insert a table',
      icon: 'table_chart',
      action: () => onCommand('| Column 1 | Column 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |'),
    },
    {
      id: 'mermaid',
      label: 'Mermaid Diagram',
      description: 'Flow chart, sequence diagram, etc.',
      icon: 'account_tree',
      action: () => onCommand('```mermaid\ngraph TD\n  A[Start] --> B[End]\n```'),
    },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % commands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + commands.length) % commands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        commands[selectedIndex].action();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, commands, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = menuRef.current?.children[selectedIndex] as HTMLElement;
    selectedElement?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <div
      ref={menuRef}
      className="slash-command-menu"
      style={{ top: position.top, left: position.left }}
    >
      {commands.map((command, index) => (
        <button
          key={command.id}
          className={`command-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => command.action()}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          {command.icon && (
            <span className="material-symbols-outlined command-icon">{command.icon}</span>
          )}
          <div className="command-content">
            <div className="command-label">{command.label}</div>
            <div className="command-description">{command.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
