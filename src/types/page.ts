/**
 * Core Page interface - represents a page/card in the system
 *
 * File-based model (NEW):
 *  - Each page is a single .md file (e.g., "workspace/Page Name.md")
 *  - Pages can link to each other using [[Page Title]] or [[page-id|Display Text]]
 *  - Kanban cards reference their board via `parentId` field
 *
 * Kanban model:
 *  - A board page has viewType='kanban'. Its `tags` define the columns.
 *  - A card (child of a board) has `parentId` set to the board's id and `kanbanColumn` to one of the board's tags.
 *  - The board can be displayed as kanban or list (UI toggle, not a separate type).
 */
export interface Highlight {
  id: string;
  text: string;
  color: string;
  style: 'highlight' | 'underline';
  startOffset: number;
  endOffset: number;
  contextBefore: string;
  contextAfter: string;
  createdAt: string;
}

export interface Memo {
  id: string;
  type: 'independent' | 'linked';
  note: string;
  // Linked memo fields (only when type === 'linked')
  highlightId?: string;
  highlightText?: string;
  highlightColor?: string;
  // Metadata
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  order: number;
}

export interface Page {
  // Metadata (stored in YAML frontmatter)
  id: string;
  title: string;
  tags: string[];               // On a board, these ARE the kanban columns
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  viewType: ViewType;
  parentId?: string;             // ID of parent page (e.g., kanban board this card belongs to)
  kanbanColumn?: string;         // Which column this card belongs to (= one of parent's tags)
  googleCalendarEventId?: string;
  pinned?: boolean;              // Whether this card is pinned to the top of its column
  pinnedAt?: string;             // Timestamp when pinned (for sorting multiple pinned cards)
  highlights?: Highlight[];      // Text highlights with colors and styles
  memos?: Memo[];                // Reading notes and annotations

  // Runtime properties (not stored in frontmatter)
  path: string;                  // File path (e.g., "workspace/Page Name.md")
  content: string;
  children?: Page[];             // Computed at runtime by filtering pages with matching parentId
  parent?: Page;                 // Computed at runtime by looking up parentId
}

/**
 * Page view types
 *  - 'document': a regular page (or a card inside a board)
 *  - 'kanban': a board whose children are grouped into columns by tags
 */
export type ViewType = 'document' | 'kanban';

/**
 * Frontmatter interface - what gets serialized to YAML
 */
export interface PageFrontmatter {
  id: string;
  title: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  viewType: ViewType;
  parentId?: string;             // ID of parent page
  kanbanColumn?: string;
  googleCalendarEventId?: string;
  pinned?: boolean;
  pinnedAt?: string;
  highlights?: Highlight[];
  memos?: Memo[];
}

/**
 * Raw page data from file system
 */
export interface RawPageData {
  frontmatter: PageFrontmatter;
  content: string;
  path: string;
}
