import { useEffect, useRef } from 'react';
import { SlashCommand } from './types';
import { PalettePosition } from './useSlashCommands';
import './SlashCommandPalette.css';

interface SlashCommandPaletteProps {
  commands: SlashCommand[];
  selectedIndex: number;
  position: PalettePosition;
  onSelect: (cmd: SlashCommand) => void;
  onClose: () => void;
}

export function SlashCommandPalette({
  commands,
  selectedIndex,
  position,
  onSelect,
}: SlashCommandPaletteProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // scrollIntoView on selection change
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector('[aria-selected="true"]');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (commands.length === 0) return null;

  return (
    <div
      className="slash-palette"
      role="listbox"
      aria-label="Slash commands"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="slash-palette-list" ref={listRef}>
        {commands.map((cmd, index) => (
          <div
            key={cmd.id}
            className={`slash-palette-item ${index === selectedIndex ? 'selected' : ''}`}
            role="option"
            aria-selected={index === selectedIndex}
            onClick={() => onSelect(cmd)}
          >
            <span className="slash-palette-icon">{cmd.icon}</span>
            <span className="slash-palette-label">{cmd.label}</span>
            <span className="slash-palette-key">/{cmd.key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
