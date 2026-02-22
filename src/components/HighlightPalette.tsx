import { useState, useEffect, useRef } from 'react';
import { getHighlightColor, getUnderlineColor } from '@/utils/colorAdjust';
import './HighlightPalette.css';

interface HighlightPaletteProps {
  position: { top: number; left: number };
  colors: string[];
  onHighlight: (color: string, style: 'highlight' | 'underline') => void;
  onClose: () => void;
}

type StyleTab = 'highlight' | 'underline';

export function HighlightPalette({ position, colors, onHighlight, onClose }: HighlightPaletteProps) {
  const [activeTab, setActiveTab] = useState<StyleTab>('highlight');
  const paletteRef = useRef<HTMLDivElement>(null);
  const [finalPosition, setFinalPosition] = useState(position);
  const hasAdjusted = useRef(false);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay to prevent immediate closing from the same click that opened it
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

  const handleColorClick = (color: string) => {
    onHighlight(color, activeTab);
    onClose();
  };

  // Adjust position once on mount to keep palette on screen
  useEffect(() => {
    if (paletteRef.current && !hasAdjusted.current) {
      const rect = paletteRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedTop = position.top;
      let adjustedLeft = position.left;

      // Adjust horizontal position
      if (rect.right > viewportWidth) {
        adjustedLeft = viewportWidth - rect.width - 10;
      }
      if (rect.left < 0) {
        adjustedLeft = 10;
      }

      // Adjust vertical position
      if (rect.bottom > viewportHeight) {
        adjustedTop = position.top - rect.height - 10;
      }
      if (rect.top < 0) {
        adjustedTop = 10;
      }

      // Only update if position actually changed
      if (adjustedTop !== position.top || adjustedLeft !== position.left) {
        setFinalPosition({ top: adjustedTop, left: adjustedLeft });
      }

      hasAdjusted.current = true;
    }
  }, [position]);

  const adjustedStyle: React.CSSProperties = {
    position: 'fixed',
    top: `${finalPosition.top}px`,
    left: `${finalPosition.left}px`,
  };

  // Split colors into rows if more than 5
  const colorRows = colors.length > 5
    ? [colors.slice(0, Math.ceil(colors.length / 2)), colors.slice(Math.ceil(colors.length / 2))]
    : [colors];

  return (
    <div
      ref={paletteRef}
      className="highlight-palette"
      style={adjustedStyle}
    >
      {/* Tabs */}
      <div className="palette-tabs">
        <button
          className={`palette-tab ${activeTab === 'highlight' ? 'active' : ''}`}
          onClick={() => setActiveTab('highlight')}
          title="Background highlight"
        >
          🎨 Highlight
        </button>
        <button
          className={`palette-tab ${activeTab === 'underline' ? 'active' : ''}`}
          onClick={() => setActiveTab('underline')}
          title="Underline"
        >
          📏 Underline
        </button>
      </div>

      {/* Colors */}
      <div className="palette-colors">
        {colorRows.map((row, rowIndex) => (
          <div key={rowIndex} className="palette-color-row">
            {row.map((color, index) => {
              // Show adjusted color preview based on active tab and theme
              const previewColor = activeTab === 'highlight' ? getHighlightColor(color) : getUnderlineColor(color);
              return (
                <button
                  key={color}
                  className="color-button"
                  style={{
                    '--color': color,
                    '--index': rowIndex * Math.ceil(colors.length / 2) + index
                  } as React.CSSProperties}
                  onClick={() => handleColorClick(color)}
                  title={`Apply ${activeTab} with this color`}
                >
                  <span className="color-preview" style={{ backgroundColor: previewColor }} />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
