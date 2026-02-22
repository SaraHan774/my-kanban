import { useEffect, useRef } from 'react';
import './HighlightHoverMenu.css';

interface HighlightHoverMenuProps {
  highlightId: string;
  currentColor: string;
  colors: string[];
  position: { top: number; left: number };
  onChangeColor: (highlightId: string, newColor: string) => void;
  onDelete: (highlightId: string) => void;
  onClose: () => void;
}

export function HighlightHoverMenu({
  highlightId,
  currentColor,
  colors,
  position,
  onChangeColor,
  onDelete,
  onClose,
}: HighlightHoverMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleColorChange = (color: string) => {
    onChangeColor(highlightId, color);
    onClose();
  };

  const handleDelete = () => {
    onDelete(highlightId);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="highlight-hover-menu"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="hover-menu-colors">
        {colors.map((color) => (
          <button
            key={color}
            className={`hover-color-btn ${color === currentColor ? 'active' : ''}`}
            style={{ backgroundColor: color }}
            onClick={() => handleColorChange(color)}
            title="Change color"
          />
        ))}
      </div>
      <div className="hover-menu-divider" />
      <button className="hover-delete-btn" onClick={handleDelete} title="Delete highlight">
        🗑️
      </button>
    </div>
  );
}
