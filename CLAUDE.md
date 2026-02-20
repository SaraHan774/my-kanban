# My Kanban - Claude Reference

## Project Overview
Local, file-based Kanban board with Notion-style pages. Data stored as markdown files with YAML frontmatter.

**Tech Stack:** React 18 + TypeScript + Vite + Tauri v2 + Zustand

## Architecture
- **Dual Platform:** PWA (browser) + Tauri desktop app
- **Storage:** Browser File System Access API / Tauri FS plugin (runtime-selected via `fileSystemFactory.ts`)
- **Data Model:** Everything is a Page (`src/types/page.ts`)
- **State:** Zustand store (`src/store/useStore.ts`)

## Key Directories
```
src/
├── components/    # UI components (Layout, PageEditor, Sidebar, modals)
├── services/      # Business logic (fileSystem, markdown, page, image, config)
├── pages/         # Route pages (Home, PageView, Settings)
├── lib/           # Utilities (slash-commands, openExternal)
├── hooks/         # Custom hooks (useMarkdownShortcuts)
├── store/         # Zustand state
└── types/         # TypeScript interfaces
```

## Data Structure
```
workspace/
└── Page Name/
    ├── index.md        # YAML frontmatter + markdown content
    ├── .images/        # Content-hashed images (SHA-256)
    └── Child Page/
        └── index.md
```

## Development
- Main branch: `main`
- Tests: Vitest + Testing Library
- Commands: `npm run dev`, `npm run tauri:dev`, `npm test`
- Never modify git history or force push to main

## Important Patterns
- Images stored as files, not base64 inline
- Kanban boards are pages with `viewType: "kanban"`
- Cards are sub-pages of kanban pages
- All file operations go through service layer abstractions
- External links open in system browser (not in-app)
