/**
 * Markdown Service
 * Handles parsing and serializing markdown files with YAML frontmatter
 */

import yaml from 'js-yaml';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import { PageFrontmatter, RawPageData } from '@/types';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

// Configure marked with GFM options
marked.use({
  breaks: true,  // Enable GFM line breaks: single newline → <br>
  gfm: true,     // Enable GitHub Flavored Markdown
});

// Configure marked with syntax highlighting + mermaid code block support
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code: string, lang: string) {
      if (lang === 'mermaid') return code; // Don't syntax-highlight mermaid
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    }
  }),
  {
    renderer: {
      code(code: string, infostring: string | undefined): string | false {
        // Handle mermaid blocks (case-insensitive, trim whitespace)
        const lang = (infostring || '').trim().toLowerCase();
        if (lang === 'mermaid') {
          console.log('[Markdown] Rendering mermaid block:', code.substring(0, 50) + '...');
          return `<div class="mermaid-block"><pre class="mermaid">${code}</pre></div>`;
        }
        return false; // fall through to default renderer
      }
    }
  }
);

export class MarkdownService {
  /**
   * Parse a markdown file with frontmatter
   */
  parse(content: string, path: string): RawPageData {
    let frontmatter: Record<string, unknown> = {};
    let markdownContent = content;

    const match = content.match(FRONTMATTER_RE);
    if (match) {
      frontmatter = (yaml.load(match[1]) as Record<string, unknown>) || {};
      markdownContent = match[2];
    }

    return {
      frontmatter: this.normalizeFrontmatter(frontmatter),
      content: markdownContent.trim(),
      path
    };
  }

  /**
   * Serialize frontmatter and content back to markdown
   */
  serialize(frontmatter: PageFrontmatter, content: string): string {
    const yamlStr = yaml.dump(frontmatter, { lineWidth: -1, quotingType: '"', forceQuotes: false });
    return `---\n${yamlStr}---\n${content}\n`;
  }

  /**
   * Convert markdown to HTML
   * NEW: Also converts wiki-style links [[Page Title]] to HTML anchors
   * @param markdown - Markdown content
   */
  async toHtml(markdown: string): Promise<string> {
    // First escape single tildes (but not double tildes for strikethrough)
    const withEscapedTildes = this.escapeSingleTildes(markdown);
    // Then convert wiki-style links to HTML
    const withLinks = this.convertWikiLinksToHtml(withEscapedTildes);
    // Then process markdown
    return marked(withLinks);
  }

  /**
   * Escape single tildes to prevent them from being treated as strikethrough
   * Only double tildes (~~) should create strikethrough
   */
  private escapeSingleTildes(content: string): string {
    // Replace single tildes with escaped version, but preserve double tildes
    // Use negative lookbehind and lookahead to match tildes that aren't part of ~~
    return content.replace(/(?<!~)~(?!~)/g, '\\~');
  }

  /**
   * Convert wiki-style links to HTML anchor tags
   * [[Page Title]] → <a href="#" data-page-ref="Page Title">Page Title</a>
   * [[page-id|Display]] → <a href="#" data-page-id="page-id">Display</a>
   */
  private convertWikiLinksToHtml(content: string): string {
    return content.replace(
      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_match, targetRef, displayText) => {
        const display = displayText?.trim() || targetRef.trim();
        const ref = targetRef.trim();
        const isId = this.looksLikeId(ref);

        if (isId) {
          return `<a href="#" class="page-link" data-page-id="${ref}">${display}</a>`;
        } else {
          return `<a href="#" class="page-link" data-page-ref="${ref}">${display}</a>`;
        }
      }
    );
  }

  /**
   * Check if a string looks like a UUID/ID vs a page title
   */
  private looksLikeId(str: string): boolean {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidPattern.test(str);
  }

  /**
   * Normalize frontmatter data to ensure all required fields exist
   * @private
   */
  private normalizeFrontmatter(data: any): PageFrontmatter {
    const now = new Date().toISOString();

    return {
      id: data.id || crypto.randomUUID(),
      title: data.title || 'Untitled',
      tags: Array.isArray(data.tags) ? data.tags : [],
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
      viewType: data.viewType || 'document',
      ...(data.parentId && { parentId: data.parentId }),
      ...(data.dueDate && { dueDate: data.dueDate }),
      ...(data.kanbanColumn && { kanbanColumn: data.kanbanColumn }),
      ...(data.googleCalendarEventId && { googleCalendarEventId: data.googleCalendarEventId }),
      ...(data.pinned !== undefined && { pinned: data.pinned }),
      ...(data.pinnedAt && { pinnedAt: data.pinnedAt }),
      highlights: Array.isArray(data.highlights) ? data.highlights : [],
      memos: Array.isArray(data.memos) ? data.memos : []
    };
  }

  /**
   * Extract plain text excerpt from markdown (for card previews)
   * @param markdown - Markdown content
   * @param maxLength - Maximum length of excerpt
   */
  getExcerpt(markdown: string, maxLength: number = 80): string {
    // Remove markdown syntax for plain text
    let text = markdown
      .replace(/- \[[ x]\]\s*/g, '') // Checkboxes
      .replace(/!\[.*?\]\(.*?\)/g, '') // Images
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, '$2$1') // Wiki links (display text or target)
      .replace(/#{1,6}\s+/g, '') // Headers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Bold
      .replace(/\*(.+?)\*/g, '$1') // Italic
      .replace(/`(.+?)`/g, '$1') // Inline code
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links
      .replace(/```[\s\S]*?```/g, '[code]') // Code blocks
      .replace(/\n+/g, ' ') // Newlines
      .trim();

    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...';
    }

    return text;
  }
}

// Singleton instance
export const markdownService = new MarkdownService();
