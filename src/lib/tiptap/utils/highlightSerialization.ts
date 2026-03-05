import { Editor } from '@tiptap/core';
import { Highlight } from '@/types';

/**
 * Extract highlights from the Tiptap editor as ProseMirror marks.
 */
export function extractHighlights(editor: Editor): Highlight[] {
  const highlights: Highlight[] = [];
  const doc = editor.state.doc;

  doc.descendants((node, pos) => {
    if (node.isText && node.marks.length > 0) {
      node.marks.forEach(mark => {
        if (mark.type.name === 'highlight') {
          highlights.push({
            id: mark.attrs.id,
            text: node.text || '',
            color: mark.attrs.color,
            style: mark.attrs.style || 'highlight',
            from: pos,
            to: pos + node.nodeSize,
            createdAt: mark.attrs.createdAt || new Date().toISOString(),
          });
        }
      });
    }
  });

  // Deduplicate by ID (in case of split nodes)
  const seen = new Set<string>();
  return highlights.filter(h => {
    if (seen.has(h.id)) return false;
    seen.add(h.id);
    return true;
  });
}

/**
 * Apply highlights to the editor as ProseMirror marks.
 * Supports both positioned highlights (from/to) and text-based highlights (MCP-created).
 */
export function applyHighlights(editor: Editor, highlights: Highlight[]): void {
  const doc = editor.state.doc;
  const docSize = doc.content.size;

  highlights.forEach(highlight => {
    try {
      let range: { from: number; to: number } | null = null;

      // Try stored positions first — but verify text actually matches
      if (highlight.from && highlight.from > 0 && highlight.to && highlight.to > 0 && highlight.to <= docSize && highlight.text) {
        try {
          const textAtPos = doc.textBetween(highlight.from, highlight.to);
          if (textAtPos === highlight.text) {
            range = { from: highlight.from, to: highlight.to };
          }
        } catch {
          // Position out of range — fall through to text search
        }
      }

      // Fall back to text search
      if (!range && highlight.text) {
        range = findTextInDoc(editor, highlight.text);
      }

      if (range) {
        editor.chain()
          .setTextSelection(range)
          .setHighlight({
            id: highlight.id,
            color: highlight.color,
            style: highlight.style || 'highlight',
          })
          .run();
      }
    } catch (error) {
      console.warn('Failed to apply highlight:', highlight.id, error);
    }
  });

  // Clear selection so the cursor doesn't stay on the last highlight
  editor.commands.blur();
}

/**
 * Find exact text in the ProseMirror document.
 * Scans every textblock, finds the search string in its textContent,
 * then resolves the absolute ProseMirror positions.
 */
function findTextInDoc(editor: Editor, searchText: string): { from: number; to: number } | null {
  if (!searchText) return null;

  const doc = editor.state.doc;
  let result: { from: number; to: number } | null = null;

  doc.descendants((node, pos) => {
    if (result) return false;
    if (!node.isTextblock) return;

    const blockText = node.textContent;
    const idx = blockText.indexOf(searchText);
    if (idx === -1) return;

    // Calculate position accounting for inline content.
    // pos = position of the block node itself
    // pos + 1 = start of inline content inside the block
    // For simple text nodes, textContent index maps directly to position offset.
    // For blocks with inline atoms, we need to walk children.
    const from = resolveTextOffset(node, pos + 1, idx);
    const to = resolveTextOffset(node, pos + 1, idx + searchText.length);

    if (from === null || to === null) return;

    // Verify the positions are valid and the text matches
    try {
      const found = doc.textBetween(from, to);
      if (found === searchText) {
        result = { from, to };
      }
    } catch {
      // Positions out of range — skip
    }
  });

  return result;
}

/**
 * Convert a text offset within a textblock's textContent to an absolute
 * ProseMirror position. This correctly handles inline atoms (images, etc.)
 * that take up position space but don't contribute to textContent.
 */
function resolveTextOffset(blockNode: any, blockContentStart: number, textOffset: number): number | null {
  let charsSeen = 0;
  let posOffset = 0;

  for (let i = 0; i < blockNode.childCount; i++) {
    const child = blockNode.child(i);

    if (child.isText) {
      const textLen = child.text?.length || 0;
      if (charsSeen + textLen >= textOffset) {
        // The target offset is within this text node
        return blockContentStart + posOffset + (textOffset - charsSeen);
      }
      charsSeen += textLen;
      posOffset += child.nodeSize;
    } else {
      // Inline atom (image, hard break, etc.)
      // These don't contribute to textContent but take up nodeSize positions
      posOffset += child.nodeSize;
    }
  }

  // If we've consumed all children and charsSeen == textOffset, the position is at the end
  if (charsSeen === textOffset) {
    return blockContentStart + posOffset;
  }

  return null;
}

/**
 * Get highlight at cursor position.
 */
export function getHighlightAtCursor(editor: Editor): Highlight | null {
  const { from, to } = editor.state.selection;
  const marks = editor.state.doc.resolve(from).marks();

  const highlightMark = marks.find(mark => mark.type.name === 'highlight');
  if (!highlightMark) return null;

  const text = editor.state.doc.textBetween(from, to);

  return {
    id: highlightMark.attrs.id,
    text,
    color: highlightMark.attrs.color,
    style: highlightMark.attrs.style || 'highlight',
    from,
    to,
    createdAt: highlightMark.attrs.createdAt || new Date().toISOString(),
  };
}
