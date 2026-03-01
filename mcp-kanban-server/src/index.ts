#!/usr/bin/env node

/**
 * MCP Server for My Kanban
 *
 * Provides tools for Claude to interact with highlights and memos
 * stored in markdown files' YAML frontmatter.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import yaml from 'js-yaml';

// Types matching the My Kanban app
interface Highlight {
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

interface Memo {
  id: string;
  type: 'independent' | 'linked';
  note: string;
  highlightId?: string;
  highlightText?: string;
  highlightColor?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  order: number;
}

interface PageFrontmatter {
  id: string;
  title: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  viewType: 'document' | 'kanban';
  parentId?: string;
  kanbanColumn?: string;
  googleCalendarEventId?: string;
  pinned?: boolean;
  pinnedAt?: string;
  highlights?: Highlight[];
  memos?: Memo[];
}

// Workspace path - configurable via environment variable
const WORKSPACE_PATH = process.env.KANBAN_WORKSPACE || path.join(process.cwd(), '../workspace');

// Helper: Read a page file
async function readPage(filename: string) {
  const filePath = path.join(WORKSPACE_PATH, filename);
  const content = await fs.readFile(filePath, 'utf-8');
  const parsed = matter(content);
  return {
    frontmatter: normalizeFrontmatter(parsed.data),
    content: parsed.content.trim(),
    path: filePath,
  };
}

// Helper: Write a page file
async function writePage(filename: string, frontmatter: PageFrontmatter, content: string) {
  const filePath = path.join(WORKSPACE_PATH, filename);
  frontmatter.updatedAt = new Date().toISOString();

  // Use same YAML options as markdownService.serialize
  const yamlStr = yaml.dump(frontmatter, {
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: false
  });
  const fileContent = `---\n${yamlStr}---\n${content}\n`;
  await fs.writeFile(filePath, fileContent, 'utf-8');
}

// Helper: List all markdown files
async function listMarkdownFiles(): Promise<string[]> {
  const files = await fs.readdir(WORKSPACE_PATH);
  return files.filter(f => f.endsWith('.md'));
}

// Helper: Generate unique ID (UUID v4 format matching codebase)
function generateId(): string {
  return crypto.randomUUID();
}

// Helper: Sanitize filename (matching pageService.sanitizeFileName)
function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper: Normalize frontmatter (matching markdownService.normalizeFrontmatter)
function normalizeFrontmatter(data: any): PageFrontmatter {
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

// MCP Server
const server = new Server(
  {
    name: 'my-kanban-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
const tools: Tool[] = [
  {
    name: 'list_pages',
    description: 'List all pages in the workspace with their highlights and memos count',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'create_page',
    description: 'Create a new page with optional content, highlights, and memos',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Page title',
        },
        content: {
          type: 'string',
          description: 'Page content (markdown)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags',
        },
        viewType: {
          type: 'string',
          enum: ['document', 'kanban'],
          description: 'View type (default: document)',
        },
        parentId: {
          type: 'string',
          description: 'Optional parent page ID for nested pages',
        },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'read_page',
    description: 'Read a specific page including all highlights and memos',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The markdown filename (e.g., "My Page.md")',
        },
      },
      required: ['filename'],
    },
  },
  {
    name: 'add_highlight',
    description: 'Add a new highlight to a page',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The markdown filename',
        },
        text: {
          type: 'string',
          description: 'The highlighted text',
        },
        color: {
          type: 'string',
          description: 'Highlight color (e.g., "#FFEB3B")',
        },
        style: {
          type: 'string',
          enum: ['highlight', 'underline'],
          description: 'Highlight style',
        },
        startOffset: {
          type: 'number',
          description: 'Start position in the content',
        },
        endOffset: {
          type: 'number',
          description: 'End position in the content',
        },
        contextBefore: {
          type: 'string',
          description: 'Text context before highlight',
        },
        contextAfter: {
          type: 'string',
          description: 'Text context after highlight',
        },
      },
      required: ['filename', 'text', 'color', 'style', 'startOffset', 'endOffset'],
    },
  },
  {
    name: 'add_memo',
    description: 'Add a new memo to a page (independent or linked to a highlight)',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The markdown filename',
        },
        note: {
          type: 'string',
          description: 'The memo content',
        },
        type: {
          type: 'string',
          enum: ['independent', 'linked'],
          description: 'Memo type',
        },
        highlightId: {
          type: 'string',
          description: 'ID of the highlight to link to (required if type is "linked")',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags for the memo',
        },
      },
      required: ['filename', 'note', 'type'],
    },
  },
  {
    name: 'update_memo',
    description: 'Update an existing memo',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The markdown filename',
        },
        memoId: {
          type: 'string',
          description: 'ID of the memo to update',
        },
        note: {
          type: 'string',
          description: 'Updated memo content',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Updated tags',
        },
      },
      required: ['filename', 'memoId', 'note'],
    },
  },
  {
    name: 'delete_highlight',
    description: 'Delete a highlight from a page',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The markdown filename',
        },
        highlightId: {
          type: 'string',
          description: 'ID of the highlight to delete',
        },
      },
      required: ['filename', 'highlightId'],
    },
  },
  {
    name: 'delete_memo',
    description: 'Delete a memo from a page',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The markdown filename',
        },
        memoId: {
          type: 'string',
          description: 'ID of the memo to delete',
        },
      },
      required: ['filename', 'memoId'],
    },
  },
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_pages': {
        const files = await listMarkdownFiles();
        const pages = await Promise.all(
          files.map(async (filename) => {
            const page = await readPage(filename);
            return {
              filename,
              title: page.frontmatter.title,
              highlights: page.frontmatter.highlights?.length || 0,
              memos: page.frontmatter.memos?.length || 0,
              viewType: page.frontmatter.viewType,
            };
          })
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(pages, null, 2),
            },
          ],
        };
      }

      case 'create_page': {
        const { title, content, tags = [], viewType = 'document', parentId } = args as any;

        // Generate filename from title (using same sanitization as pageService)
        const sanitizedName = sanitizeFileName(title);
        const filename = `${sanitizedName}.md`;

        // Check if file already exists
        const files = await listMarkdownFiles();
        if (files.includes(filename)) {
          throw new Error(`File "${filename}" already exists. Use a different title.`);
        }

        // Create frontmatter (matching pageService.createPage structure)
        const frontmatter: PageFrontmatter = {
          id: generateId(), // Now uses crypto.randomUUID()
          title,
          tags,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          viewType,
          ...(parentId && { parentId }), // Only include if defined
          highlights: [],
          memos: [],
        };

        // Write the file
        await writePage(filename, frontmatter, content);

        return {
          content: [
            {
              type: 'text',
              text: `Page created successfully: ${filename}`,
            },
          ],
        };
      }

      case 'read_page': {
        const { filename } = args as { filename: string };
        const page = await readPage(filename);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  frontmatter: page.frontmatter,
                  content: page.content,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'add_highlight': {
        const {
          filename,
          text,
          color,
          style,
          startOffset,
          endOffset,
          contextBefore = '',
          contextAfter = '',
        } = args as any;

        const page = await readPage(filename);
        const highlight: Highlight = {
          id: generateId(),
          text,
          color,
          style,
          startOffset,
          endOffset,
          contextBefore,
          contextAfter,
          createdAt: new Date().toISOString(),
        };

        page.frontmatter.highlights = page.frontmatter.highlights || [];
        page.frontmatter.highlights.push(highlight);

        await writePage(filename, page.frontmatter, page.content);

        return {
          content: [
            {
              type: 'text',
              text: `Highlight added successfully. ID: ${highlight.id}`,
            },
          ],
        };
      }

      case 'add_memo': {
        const { filename, note, type, highlightId, tags } = args as any;

        const page = await readPage(filename);

        // If linked memo, find the highlight
        let highlightText: string | undefined;
        let highlightColor: string | undefined;
        if (type === 'linked' && highlightId) {
          const highlight = page.frontmatter.highlights?.find(h => h.id === highlightId);
          if (!highlight) {
            throw new Error(`Highlight with ID ${highlightId} not found`);
          }
          highlightText = highlight.text;
          highlightColor = highlight.color;
        }

        const memo: Memo = {
          id: generateId(),
          type,
          note,
          highlightId,
          highlightText,
          highlightColor,
          tags,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          order: (page.frontmatter.memos?.length || 0) + 1,
        };

        page.frontmatter.memos = page.frontmatter.memos || [];
        page.frontmatter.memos.push(memo);

        await writePage(filename, page.frontmatter, page.content);

        return {
          content: [
            {
              type: 'text',
              text: `Memo added successfully. ID: ${memo.id}`,
            },
          ],
        };
      }

      case 'update_memo': {
        const { filename, memoId, note, tags } = args as any;

        const page = await readPage(filename);
        const memo = page.frontmatter.memos?.find(m => m.id === memoId);

        if (!memo) {
          throw new Error(`Memo with ID ${memoId} not found`);
        }

        memo.note = note;
        memo.updatedAt = new Date().toISOString();
        if (tags !== undefined) {
          memo.tags = tags;
        }

        await writePage(filename, page.frontmatter, page.content);

        return {
          content: [
            {
              type: 'text',
              text: `Memo updated successfully`,
            },
          ],
        };
      }

      case 'delete_highlight': {
        const { filename, highlightId } = args as { filename: string; highlightId: string };

        const page = await readPage(filename);
        const initialLength = page.frontmatter.highlights?.length || 0;
        page.frontmatter.highlights = page.frontmatter.highlights?.filter(
          h => h.id !== highlightId
        );

        if ((page.frontmatter.highlights?.length || 0) === initialLength) {
          throw new Error(`Highlight with ID ${highlightId} not found`);
        }

        await writePage(filename, page.frontmatter, page.content);

        return {
          content: [
            {
              type: 'text',
              text: `Highlight deleted successfully`,
            },
          ],
        };
      }

      case 'delete_memo': {
        const { filename, memoId } = args as { filename: string; memoId: string };

        const page = await readPage(filename);
        const initialLength = page.frontmatter.memos?.length || 0;
        page.frontmatter.memos = page.frontmatter.memos?.filter(m => m.id !== memoId);

        if ((page.frontmatter.memos?.length || 0) === initialLength) {
          throw new Error(`Memo with ID ${memoId} not found`);
        }

        await writePage(filename, page.frontmatter, page.content);

        return {
          content: [
            {
              type: 'text',
              text: `Memo deleted successfully`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('My Kanban MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
