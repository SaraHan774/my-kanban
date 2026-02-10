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
   * @param markdown - Markdown content
   */
  async toHtml(markdown: string): Promise<string> {
    return marked(markdown);
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
      ...(data.dueDate && { dueDate: data.dueDate }),
      ...(data.kanbanColumn && { kanbanColumn: data.kanbanColumn }),
      ...(data.googleCalendarEventId && { googleCalendarEventId: data.googleCalendarEventId })
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
