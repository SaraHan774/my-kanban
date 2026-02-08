import { useEffect, useRef } from 'react';
import { SlashCommand } from './types';
import './SlashCommandPalette.css';

interface SlashCommandPaletteProps {
  commands: SlashCommand[];
  selectedIndex: number;
  onSelect: (cmd: SlashCommand) => void;
  onClose: () => void;
}

export function SlashCommandPalette({
  commands,
  selectedIndex,
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
