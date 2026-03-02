import { TocHeading } from '@/services/tocService';
import './TocPanel.css';

interface TocPanelProps {
  headings: TocHeading[];
  onHeadingClick: (headingId: string) => void;
  activeHeadingId?: string;
}

export function TocPanel({ headings, onHeadingClick, activeHeadingId }: TocPanelProps) {
  if (headings.length === 0) {
    return (
      <div className="toc-panel">
        <div className="toc-empty">No headings</div>
      </div>
    );
  }

  return (
    <div className="toc-panel">
      <nav className="toc-list">
        {headings.map((heading) => (
          <button
            key={heading.id}
            className={`toc-item toc-level-${heading.level} ${heading.id === activeHeadingId ? 'active' : ''}`}
            onClick={() => onHeadingClick(heading.id)}
            title={heading.text}
          >
            {heading.text}
          </button>
        ))}
      </nav>
    </div>
  );
}
