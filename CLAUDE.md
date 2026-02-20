# My Kanban - Claude Reference

## Project Overview
Local, file-based Kanban board with Notion-style pages. Data stored as **single markdown files** (not folders) with YAML frontmatter.

**Tech Stack:** React 18 + TypeScript + Vite + Tauri v2 + Zustand

## Architecture (NEW - File-Based)
- **Dual Platform:** PWA (browser) + Tauri desktop app
- **Storage:** Browser File System Access API / Tauri FS plugin (runtime-selected via `fileSystemFactory.ts`)
- **Data Model:** Everything is a Page (`src/types/page.ts`)
- **File Structure:** One `.md` file per page (not `folder/index.md`)
- **Images:** Centralized in `workspace/.images/` with content-addressed storage
- **Page Hierarchy:** `parentId` field (not file system structure)
- **State:** Zustand store (`src/store/useStore.ts`)

## Key Directories
```
src/
├── components/    # UI components (Layout, PageEditor, Sidebar, modals)
├── services/      # Business logic (fileSystem, markdown, page, image, config, migration, link)
├── pages/         # Route pages (Home, PageView, Settings)
├── lib/           # Utilities (slash-commands, openExternal)
├── hooks/         # Custom hooks (useMarkdownShortcuts, useMermaid)
├── store/         # Zustand state
└── types/         # TypeScript interfaces (page, link, filter, config, fileSystem)
```

## Data Structure (NEW)
```
workspace/
├── .images/           # Centralized image storage (SHA-256 content hashing)
│   ├── abc123.png
│   └── def456.png
├── Project A.md       # Root-level page
├── Task 1.md          # Child page (has parentId → Project A)
├── Task 2.md          # Child page (has parentId → Project A)
└── Notes.md           # Root-level page
```

**Page Format:**
```yaml
---
id: "uuid"
title: "Page Title"
parentId: "parent-page-id"  # Optional: for nested pages
kanbanColumn: "To Do"       # Optional: for kanban cards
tags: ["work"]
createdAt: "2026-02-21T..."
updatedAt: "2026-02-21T..."
viewType: "document"
---

# Page Content

Link to other pages: [[Page Title]] or [[page-id|Display]]
Images: ![alt](.images/hash.png)
```

## Development
- Main branch: `main`
- Feature branch: `refactor/single-file-structure`
- Tests: Vitest + Testing Library
- Commands: `npm run dev`, `npm run tauri:dev`, `npm test`
- Never modify git history or force push to main

## Important Patterns (UPDATED)
- **Single file per page** - `Page.md` not `Page/index.md`
- **Images centralized** - All in `workspace/.images/`, not per-page folders
- **Page hierarchy via parentId** - Not file structure
- **Wiki-style links** - `[[Page Title]]` or `[[id|Display]]` (see `linkService.ts`)
- **Kanban cards** - Root-level pages (no parentId) on Home board
- **Nested boards** - Pages with parentId belong to other boards
- **Migration** - Auto-detected in Settings if old structure exists
- All file operations go through service layer abstractions
- External links open in system browser (not in-app)

## Key Services
- `pageService` - CRUD for pages, loads children by parentId
- `linkService` - Parse/resolve wiki links, backlinks
- `imageService` - Centralized image storage
- `migrationService` - Convert old folder structure to new file structure
- `fileSystemService` - Abstraction over browser/Tauri FS APIs
- `markdownService` - Parse/render markdown with wiki link support
