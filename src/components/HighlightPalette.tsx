import { useState, useEffect, useRef } from 'react';
import { getHighlightColor, getUnderlineColor } from '@/utils/colorAdjust';
import { TooltipWindow } from './TooltipWindow';
import './HighlightPalette.css';

interface HighlightPaletteProps {
  anchorRect: DOMRect;
  colors: string[];
  onHighlight: (color: string, style: 'highlight' | 'underline') => void;
  onClose: () => void;
}

type StyleTab = 'highlight' | 'underline';

export function HighlightPalette({ anchorRect, colors, onHighlight, onClose }: HighlightPaletteProps) {
  const [activeTab, setActiveTab] = useState<StyleTab>('highlight');
  const paletteRef = useRef<HTMLDivElement>(null);

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

  // Split colors into rows if more than 5
  const colorRows = colors.length > 5
    ? [colors.slice(0, Math.ceil(colors.length / 2)), colors.slice(Math.ceil(colors.length / 2))]
    : [colors];

  return (
    <TooltipWindow anchorRect={anchorRect} placement="top" pointerEvents>
      <div
        ref={paletteRef}
        className="highlight-palette"
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
    </TooltipWindow>
  );
}
