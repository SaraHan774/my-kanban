/**
 * Simple markdown to HTML conversion for initial proof of concept
 * Will be enhanced with proper prosemirror-markdown integration later
 */

/**
 * Convert markdown string to HTML (temporary simple implementation)
 * Used when loading content into the editor
 */
export function markdownToDoc(markdown: string): string {
  if (!markdown.trim()) {
    return '<p></p>';
  }

  // For now, return markdown as-is
  // Tiptap's StarterKit will handle basic markdown rendering
  return markdown;
}

/**
 * Convert editor content to markdown string
 * Used when saving content from the editor
 */
export function docToMarkdown(doc: Record<string, any>): string {
  try {
    // For Phase 0, we'll use a simple text extraction
    // This will be replaced with proper markdown serialization
    return extractTextFromDoc(doc);
  } catch (error) {
    console.error('Error serializing to markdown:', error);
    return '';
  }
}

/**
 * Extract plain text from ProseMirror document
 * Temporary implementation for Phase 0 validation
 */
function extractTextFromDoc(doc: Record<string, any>): string {
  if (!doc || !doc.content) return '';

  let text = '';

  function processNode(node: any) {
    if (node.type === 'text') {
      text += node.text || '';
    } else if (node.content) {
      node.content.forEach(processNode);
      // Add newlines after paragraphs and headings
      if (node.type === 'paragraph' || node.type === 'heading') {
        text += '\n\n';
      }
    }
  }

  doc.content.forEach(processNode);

  return text.trim();
}
