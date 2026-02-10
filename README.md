# My Kanban

A local, file-based Kanban board app with Notion-like pages. All data is stored as markdown files on your local file system, making it easy to track with git and own your data completely.

Available as both a **Progressive Web App (PWA)** and a **native desktop app** powered by [Tauri](https://tauri.app).

## Features

### Core Functionality
- **Markdown Notes** - Full markdown syntax support with YAML frontmatter
- **Notion-style Pages** - Everything is a page; create nested page structures infinitely
- **Tag System** - Categorize pages with tags and filter by them
- **Kanban Boards** - Any page can become a Kanban board with custom columns
- **Todo Checklists** - GitHub-style checklists with interactive checkboxes
- **Filter & Search** - Filter by tags, dates, and full-text search
- **Code Formatting** - Code blocks with syntax highlighting via highlight.js
- **Mermaid Diagrams** - Render flowcharts, sequence diagrams, and more with [Mermaid](https://mermaid.js.org/) syntax. Click any diagram to zoom in
- **Find in Page** - Press `Cmd/Ctrl+F` to search within the current page with overlay highlighting
- **Slash Commands** - Type `/` in the editor to quickly insert markdown snippets (headings, code blocks, tables, links, etc.). Fully customizable via Settings
- **Font Customization** - Customize font family and size for the editor, preview, and UI independently via Settings
- **Dark/Light Theme** - Toggle between dark and light modes
- **Desktop Zoom** - `Cmd/Ctrl + =` to zoom in, `Cmd/Ctrl + -` to zoom out, `Cmd/Ctrl + 0` to reset
- **Native Desktop App** - Tauri-powered app for macOS, Windows, and Linux
- **PWA Support** - Install from the browser and use offline

### Editor
- **Image Insertion** - Paste from clipboard, drag-and-drop, or use the toolbar file picker. Images are stored as files in a `.images/` directory (not inline base64), keeping your markdown clean
- **Keyboard Shortcuts** - Cmd/Ctrl+B (bold), Cmd/Ctrl+I (italic), Cmd/Ctrl+E (inline code), Cmd/Ctrl+S (save)
- **Tab Indentation** - Tab/Shift+Tab to indent/dedent lines (works with multi-line selections)
- **Quick Edit** - Press `E` on any page to enter edit mode, `Escape` to cancel

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript |
| Build | Vite |
| Desktop | Tauri v2 |
| State | Zustand |
| Fonts | Pretendard (UI), Fira Code (code) |
| Storage | File System Access API (browser) / Tauri FS plugin (desktop) |
| Markdown | js-yaml + marked + marked-highlight |
| Diagrams | Mermaid |
| Syntax Highlighting | highlight.js |
| Testing | Vitest + Testing Library |

## Data Structure

Every entity in the app is a **Page** (Notion-style unified model):

```
workspace/
├── Project A/
│   ├── index.md           # Project A page (viewType: kanban)
│   ├── .images/           # Images referenced by index.md
│   │   └── a1b2c3d4e5f6.png
│   ├── Task 1/
│   │   ├── index.md       # Task 1 card
│   │   └── Subtask 1-1/
│   │       └── index.md   # Nested sub-page
│   └── Task 2/
│       └── index.md
└── Project B/
    └── index.md
```

Images pasted or dropped into a page are saved as files under each page's `.images/` directory with content-hashed filenames (SHA-256). The markdown references them with short relative paths like `![screenshot](.images/a1b2c3d4e5f6.png)` instead of embedding large base64 data URLs.

Each `index.md` contains:
- **YAML frontmatter** - metadata (title, tags, dates, view type, etc.)
- **Markdown content** - the actual page content

Example page:

```markdown
---
id: "550e8400-e29b-41d4-a716-446655440000"
title: "My Project Tasks"
tags: ["work", "urgent"]
createdAt: "2026-02-08T10:30:00Z"
updatedAt: "2026-02-08T15:45:00Z"
viewType: "kanban"
kanbanColumns:
  - id: "col-1"
    name: "To Do"
    order: 0
  - id: "col-2"
    name: "In Progress"
    order: 1
  - id: "col-3"
    name: "Done"
    order: 2
---

# My Project Tasks

This is the content of the page.
```

## Getting Started

### Prerequisites
- Node.js 18+
- Modern browser with File System Access API support (Chrome, Edge, Opera) — for PWA mode
- [Rust toolchain](https://www.rust-lang.org/tools/install) — for Tauri desktop builds

### Option 1: Download Desktop App (Recommended)

Download the latest release for your platform from the [Releases](https://github.com/SaraHan774/my-kanban/releases) page.

### Option 2: Run Locally for Development

```bash
# Install dependencies
npm install

# Run as web app (PWA)
npm run dev

# Run as Tauri desktop app
npm run tauri:dev
```

Open `http://localhost:5173` in your browser for the web version.

### Building for Production

```bash
# Web (PWA) build
npm run build
npm run preview

# Tauri desktop build
npm run tauri:build
```

## Usage

### First-Time Setup

1. **Grant folder access:**
   - Click "Select Workspace Folder"
   - Choose a folder where your data will be stored
   - The app will create a `workspace/` subfolder inside

2. **Start creating:**
   - Click "New Page" in the sidebar
   - Choose page type (Document or Kanban)
   - Start organizing your work!

### Kanban Boards

1. Create a page and set its view type to Kanban
2. Define custom columns
3. Sub-pages automatically become cards
4. Cards show title, tags, due date, and excerpt

### Tags & Filtering

- Add tags to any page in frontmatter: `tags: ["work", "urgent"]`
- Filter pages by tags in the sidebar
- Search by title or content

### Keyboard Shortcuts

| Shortcut | Context | Action |
|---|---|---|
| `E` | Page view | Enter edit mode |
| `Escape` | Editor | Cancel editing |
| `Cmd/Ctrl + S` | Editor | Save |
| `Cmd/Ctrl + B` | Editor | Toggle bold |
| `Cmd/Ctrl + I` | Editor | Toggle italic |
| `Cmd/Ctrl + E` | Editor | Toggle inline code |
| `Cmd/Ctrl + F` | Page view / Editor | Find in page |
| `Tab` | Editor | Indent line(s) |
| `Shift + Tab` | Editor | Dedent line(s) |
| `/` | Editor | Open slash command palette |
| `Cmd/Ctrl + =` | Desktop app | Zoom in |
| `Cmd/Ctrl + -` | Desktop app | Zoom out |
| `Cmd/Ctrl + 0` | Desktop app | Reset zoom |

### Git Integration

Since everything is stored as markdown files:

```bash
cd path/to/your/workspace
git init
git add .
git commit -m "Initial commit"
```

## Project Structure

```
my-kanban/
├── src/
│   ├── components/         # React components
│   │   ├── Layout.tsx
│   │   ├── PageEditor.tsx
│   │   ├── Sidebar.tsx
│   │   ├── CreatePageModal.tsx
│   │   ├── CreateTodoModal.tsx
│   │   └── InstallPrompt.tsx
│   ├── data/              # App-level default data
│   │   └── defaultSlashCommands.ts
│   ├── hooks/             # Custom React hooks
│   │   └── useMarkdownShortcuts.ts
│   ├── lib/               # Reusable libraries
│   │   ├── openExternal.ts
│   │   └── slash-commands/
│   │       ├── types.ts
│   │       ├── useSlashCommands.ts
│   │       └── SlashCommandPalette.tsx
│   ├── pages/             # Page components
│   │   ├── Home.tsx
│   │   ├── PageView.tsx
│   │   └── Settings.tsx
│   ├── services/          # Business logic
│   │   ├── fileSystem.ts           # Browser File System Access API
│   │   ├── tauriFileSystem.ts      # Tauri FS plugin adapter
│   │   ├── fileSystemFactory.ts    # Runtime adapter selection
│   │   ├── imageService.ts         # Image storage & blob URL caching
│   │   ├── markdown.ts
│   │   ├── pageService.ts
│   │   └── configService.ts
│   ├── store/             # Zustand state management
│   │   └── useStore.ts
│   ├── types/             # TypeScript interfaces
│   │   ├── page.ts
│   │   ├── filter.ts
│   │   ├── config.ts
│   │   └── filesystem.d.ts
│   ├── test/              # Test utilities & mocks
│   └── styles/
│       └── global.css
├── src-tauri/             # Tauri desktop app (Rust)
│   ├── tauri.conf.json
│   ├── Cargo.toml
│   └── src/
├── docs/                  # Landing page (GitHub Pages)
│   └── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run tauri:dev` | Start Tauri desktop dev mode |
| `npm run tauri:build` | Build Tauri desktop app |

## Browser Support

**PWA mode** requires the File System Access API:
- Chrome / Edge 86+
- Opera 72+
- Firefox and Safari are not yet supported

**Tauri desktop app** works on macOS 10.15+, Windows 10+, and Linux.

## Roadmap

- [x] Core page CRUD operations
- [x] Markdown parsing with frontmatter
- [x] Kanban board view
- [x] Tag system
- [x] File system integration
- [x] Dark/light theme toggle
- [x] Slash commands with full customization
- [x] Settings page for command management
- [x] Tauri native desktop app
- [x] Todo checklists with interactive checkboxes
- [x] Editor keyboard shortcuts (bold, italic, code, tab indent)
- [x] Image insertion (paste, drag-and-drop, file picker)
- [x] File-based image storage (`.images/` directory with content hashing)
- [x] Mermaid diagram rendering with click-to-zoom
- [x] Find in page (`Cmd/Ctrl+F`) with overlay highlighting
- [x] Font customization (editor, preview, UI fonts and sizes)
- [x] Desktop zoom controls (`Cmd+=/Cmd+-/Cmd+0`)
- [ ] Drag-and-drop for kanban cards
- [ ] Due date tracking
- [ ] Google Calendar sync
- [ ] Advanced filtering UI
- [ ] Rich text editor mode
- [ ] Export to PDF
- [ ] Mobile responsive design

## Contributing

This is a personal project, but suggestions and improvements are welcome!

## License

MIT License - feel free to use this for your own projects.
