# My Kanban

A local, file-based Kanban board app with Notion-like pages. All data is stored as markdown files on your local file system, making it easy to track with git and own your data completely.

## ✨ Features

### Core Functionality
- 📝 **Markdown Notes** - Full markdown syntax support with YAML frontmatter
- 📄 **Notion-style Pages** - Everything is a page; create nested page structures infinitely
- 🏷️ **Tag System** - Categorize pages with tags and filter by them
- 📋 **Kanban Boards** - Any page can become a Kanban board with custom columns
- 🔍 **Filter & Search** - Filter by tags, dates, and full-text search
- 💻 **Code Formatting** - Full support for code blocks with syntax highlighting
- ⚡ **Slash Commands** - Type `/` in the editor to quickly insert markdown snippets (headings, code blocks, tables, links, etc.). Fully customizable — edit built-in commands or add your own via Settings.

### Additional Features (Coming Soon)
- 📅 **Due Dates** - Set task due dates
- 🔄 **Google Calendar Sync** - Sync due dates with Google Calendar

## 🏗️ Architecture

### Technology Stack
- **Frontend**: React + TypeScript
- **Build Tool**: Vite
- **PWA**: Progressive Web App (works in browser, can be installed)
- **State Management**: Zustand
- **Storage**: Local file system via File System Access API
- **Markdown**: gray-matter (frontmatter) + marked (rendering)

### Data Structure

Every entity in the app is a **Page** (Notion-style unified model):

```
workspace/
├── Project A/
│   ├── index.md           # Project A page (viewType: kanban)
│   ├── Task 1/
│   │   ├── index.md       # Task 1 card
│   │   └── Subtask 1-1/
│   │       └── index.md   # Nested sub-page
│   └── Task 2/
│       └── index.md
└── Project B/
    └── index.md
```

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

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (for development)
- Modern browser with File System Access API support (Chrome, Edge, Opera)

### Option 1: Install as Desktop App (Recommended)

The easiest way to use My Kanban is to install it as a desktop application:

1. **Visit the hosted app** (or run it locally - see Option 2)
2. **Look for the install prompt** at the bottom of the screen
3. **Click "Install"** to add it to your desktop
4. **Launch from your applications** folder or start menu

Once installed:
- ✅ Works like a native desktop app
- ✅ Accessible from your app launcher/dock
- ✅ Runs in standalone window (no browser UI)
- ✅ Works offline after first load
- ✅ Automatic updates when online

**Manual Installation (if prompt doesn't appear):**
- **Chrome/Edge**: Click the ⊕ icon in the address bar → "Install"
- **Desktop**: Look for "Install My Kanban" in browser menu

### Option 2: Run Locally for Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run development server:**
   ```bash
   npm run dev
   ```

3. **Open in browser:**
   Navigate to `http://localhost:5173`

4. **Install as desktop app:**
   - The install prompt will appear automatically
   - Or use browser's install option in the menu

### Building for Production

```bash
npm run build
npm run preview
```

The build output will be in the `dist/` folder, ready to:
- Deploy to any static hosting service
- Open locally as a PWA
- Install as desktop application

## 📖 Usage Guide

### First-Time Setup

1. **Grant folder access:**
   - Click "Select Workspace Folder"
   - Choose a folder where your data will be stored
   - The app will create a `workspace/` subfolder inside
   - Permission is remembered across sessions

2. **Start creating:**
   - Click "New Page" in the sidebar
   - Choose page type (Document or Kanban)
   - Start organizing your work!

### Creating Pages

1. Pages are organized in a tree structure (like Notion)
2. Each page can have unlimited sub-pages
3. Pages can be viewed as:
   - **Document** - Regular markdown notes
   - **Kanban** - Task board with customizable columns
   - **List** - Simple list view (coming soon)

### Kanban Boards

1. Create a page or edit an existing one
2. Set `viewType: "kanban"` in frontmatter
3. Define custom columns in `kanbanColumns`
4. Sub-pages automatically become cards
5. Cards show title, tags, due date, and excerpt

### Tags & Filtering

- Add tags to any page in frontmatter: `tags: ["work", "urgent"]`
- Filter pages by tags in the sidebar
- Search by title or content

### Git Integration

Since everything is stored as markdown files:

```bash
# Initialize git in your workspace folder
cd path/to/your/workspace
git init
git add .
git commit -m "Initial commit"

# Track changes
git status
git diff
```

## 🔧 Development

### Project Structure

```
my-kanban/
├── src/
│   ├── components/         # React components
│   │   ├── Layout.tsx
│   │   ├── PageEditor.tsx
│   │   └── Sidebar.tsx
│   ├── data/              # App-level default data
│   │   └── defaultSlashCommands.ts
│   ├── lib/               # Reusable libraries (app-independent)
│   │   └── slash-commands/ # Portable slash command system
│   │       ├── types.ts
│   │       ├── useSlashCommands.ts
│   │       ├── SlashCommandPalette.tsx
│   │       └── SlashCommandPalette.css
│   ├── pages/             # Page components
│   │   ├── Home.tsx
│   │   ├── PageView.tsx
│   │   └── Settings.tsx
│   ├── services/          # Business logic
│   │   ├── fileSystem.ts
│   │   ├── markdown.ts
│   │   └── pageService.ts
│   ├── store/             # Zustand state management
│   │   └── useStore.ts
│   ├── types/             # TypeScript interfaces
│   │   ├── page.ts
│   │   ├── filter.ts
│   │   └── config.ts
│   └── styles/            # Global styles
│       └── global.css
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### Key Services

- **FileSystemService** - Handles all file I/O using File System Access API
- **MarkdownService** - Parses/serializes markdown with frontmatter
- **PageService** - High-level CRUD operations for pages

### Adding New Features

1. Define types in `src/types/`
2. Implement logic in `src/services/`
3. Create UI components in `src/components/`
4. Add state management in `src/store/useStore.ts`

## 🌐 Browser Support

The app requires the **File System Access API**, which is supported in:
- ✅ Chrome/Edge 86+
- ✅ Opera 72+
- ❌ Firefox (not yet supported)
- ❌ Safari (not yet supported)

For unsupported browsers, consider using:
- Chrome or Edge
- Or implement alternative storage (IndexedDB fallback)

## 📝 Data Format

### Page Frontmatter Schema

```typescript
interface PageFrontmatter {
  id: string;                    // UUID
  title: string;
  tags: string[];
  createdAt: string;             // ISO 8601
  updatedAt: string;
  dueDate?: string;              // Optional
  viewType: 'document' | 'kanban' | 'list';
  kanbanColumn?: string;         // If this page is a card in a kanban
  kanbanColumns?: KanbanColumn[]; // If this page is a kanban board
  pomodoroSessions?: PomodoroSession[];
  googleCalendarEventId?: string;
}
```

## 🎯 Roadmap

- [x] Core page CRUD operations
- [x] Markdown parsing with frontmatter
- [x] Kanban board view
- [x] Tag system
- [x] File system integration
- [x] Dark/light theme toggle
- [x] Slash commands with full customization
- [x] Settings page for command management
- [ ] Due date tracking
- [ ] Google Calendar sync
- [ ] Advanced filtering UI
- [ ] Drag-and-drop for kanban cards
- [ ] Rich text editor mode
- [ ] Export to PDF
- [ ] Mobile responsive design

## 🤝 Contributing

This is a personal project, but suggestions and improvements are welcome!

## 📄 License

MIT License - feel free to use this for your own projects.

## 💡 Why This App?

**No costs, full control:**
- 🆓 **100% free** - no subscriptions, no hidden fees
- 💾 **Your data, your disk** - everything lives on your file system
- 🔒 **Complete privacy** - no servers, no tracking, no uploads
- 📱 **Desktop app** - install and use like a native application
- 🌐 **Works offline** - PWA with full offline support
- 📝 **Markdown-based** - portable and future-proof format
- 🔄 **Git-friendly** - track changes with version control
- 🚫 **No vendor lock-in** - your notes are yours forever
- 🖥️ **Cross-platform** - works on Windows, Mac, Linux

Built as a **Notion alternative** for developers and privacy-conscious users who want to own their data.

## 🖥️ Desktop Features

When installed as a desktop app, you get:
- Standalone window (no browser UI clutter)
- Quick launch from dock/taskbar
- System integration (file associations, notifications ready)
- Offline-first design
- Automatic background updates
- Native-like performance
