# Quick Start Guide

Get your Kanban board running in 3 steps!

## 1. Install & Run

```bash
# Install dependencies (already done!)
npm install

# Start development server
npm run dev
```

Open your browser to `http://localhost:5173`

## 2. Select Workspace Folder

1. Click "Select Workspace Folder" button
2. Choose a folder on your computer where you want your data stored
3. The app will create a `workspace/` subfolder inside

**Tip:** To use the sample workspace:
```bash
# Copy the sample workspace to your desired location
cp -r workspace-template/workspace /path/to/your/folder/
```

Then select `/path/to/your/folder` as your workspace.

## 3. Start Using!

### Creating Pages

- Click the "+" button in the sidebar
- Choose a parent page or create at root level
- Set title, tags, and view type

### Creating a Kanban Board

1. Create or edit a page
2. In the frontmatter, set:
   ```yaml
   viewType: "kanban"
   kanbanColumns:
     - id: "todo"
       name: "To Do"
       order: 0
     - id: "doing"
       name: "Doing"
       order: 1
     - id: "done"
       name: "Done"
       order: 2
   ```
3. Add sub-pages - they become cards!

### Using Tags

Add tags to any page:
```yaml
tags: ["work", "urgent", "frontend"]
```

Filter by tags in the sidebar (coming soon in UI).

### Markdown Support

Write notes using full markdown:

```markdown
# Heading

**Bold** and *italic* text

- Lists
- Items

\```javascript
// Code blocks with syntax highlighting
function hello() {
  console.log("Hello!");
}
\```

[Links](https://example.com)
```

## Git Integration (Optional)

Track your changes with git:

```bash
cd /path/to/your/workspace
git init
git add .
git commit -m "Initial commit"

# Make changes, then:
git add .
git commit -m "Updated tasks"
git log  # See history
```

## Browser Compatibility

**Supported:**
- ✅ Chrome 86+
- ✅ Edge 86+
- ✅ Opera 72+

**Not Supported (yet):**
- ❌ Firefox (File System Access API not available)
- ❌ Safari (File System Access API not available)

## Need Help?

- See [README.md](README.md) for full documentation
- Check the sample workspace in `workspace-template/`
- Explore the "Getting Started" page in the sample workspace

## Tips

1. **Organize with folders:** Each page is a folder, sub-pages are subfolders
2. **Use meaningful names:** Folder names become page titles
3. **Tag everything:** Tags make filtering easy
4. **Backup your data:** Your workspace folder contains everything - back it up!
5. **Use git:** Version control your notes and tasks
6. **Code-friendly:** Store code snippets, documentation, technical notes

Happy organizing! 🚀
