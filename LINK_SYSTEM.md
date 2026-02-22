# Page Link System

## Overview
My Kanban uses a robust ID-based linking system that remains stable even when page titles or file names change.

## Link Formats

### ID-Based Links (Recommended)
```markdown
[[page-id|Display Text]]
```

**Advantages:**
- ✅ Safe from file name changes
- ✅ Safe from title changes
- ✅ Unique and permanent
- ✅ Works even if page is moved
- ✅ Custom display text supported

**Examples:**
```markdown
[[550e8400-e29b-41d4-a716-446655440000|My Project]]
[[page-123|Click here for details]]
[[abc-def-ghi]]  <!-- Uses page title as display text -->
```

### Title-Based Links (Simple)
```markdown
[[Page Title]]
```

**Advantages:**
- ✅ Easy to type
- ✅ Human-readable

**Disadvantages:**
- ❌ Breaks when title changes
- ❌ Case-sensitive matching

**Example:**
```markdown
[[My Project Tasks]]
```

## Copy Link Feature

Every page has a "Copy Link" button that:
1. Copies an ID-based link to your clipboard
2. Format: `[[page-id|Page Title]]`
3. Shows "✓ Copied!" confirmation for 2 seconds

### Usage
1. Navigate to any page
2. Click the "Copy Link" button (🔗 icon)
3. Paste the link in another page's editor
4. The link will work even if you rename the page file or change the title

## How Links Are Resolved

### Rendering (markdown → HTML)
1. Wiki link syntax `[[...]]` is detected in markdown content
2. Links are converted directly to HTML (before markdown processing):
   - Format: `<a href="/page/{id}" class="page-link">Display Text</a>`
   - ID-based links: `[[page-id|Custom Text]]` → uses custom text or page title
   - Title-based links: `[[Page Title]]` → looks up page by title
3. Broken links (page not found) are styled with strikethrough: `<span class="wiki-link-broken">[[Missing]]</span>`
4. Page links have distinct styling (underline on hover) vs regular markdown links (bottom border)

### Navigation (click handling)
1. Click handler intercepts clicks on links with `href="/page/{id}"`
2. Uses React Router to navigate without page reload
3. Only navigates if the target page is different from current page
4. External links (`http://`, `https://`) open in system browser (desktop) or new tab (web)

## Stability Guarantees

| Change | ID-Based Link | Title-Based Link |
|--------|---------------|------------------|
| Rename file | ✅ Works | ✅ Works |
| Change title | ✅ Works | ❌ Breaks |
| Move to subfolder | ✅ Works | ✅ Works |
| Change content | ✅ Works | ✅ Works |

## Best Practices

1. **Use Copy Link button** - Always use the built-in "Copy Link" feature for creating links
2. **ID-based for important links** - Use ID-based links for critical references
3. **Title-based for convenience** - Use title-based links for quick, temporary references
4. **Check broken links** - If you change a title, search for `[[Old Title]]` and update

## Implementation Details

### Wiki Link Converter (`src/utils/wikiLinks.ts`)
```typescript
// Parse wiki-style links from markdown
parseWikiLinks(content: string): WikiLink[]

// Find a page by ID or title
findPageByIdOrTitle(target: string, pages: Page[]): Page | undefined

// Convert wiki links to HTML with proper classes
// This runs BEFORE markdown processing to ensure correct styling
convertWikiLinksToMarkdown(content: string, pages: Page[]): string
```

### Copy Link Handler (`src/pages/PageView.tsx`)
```typescript
const handleCopyLink = async () => {
  const linkText = `[[${page.id}|${page.title}]]`;
  await navigator.clipboard.writeText(linkText);
  // Show confirmation
};
```

## Future Enhancements

- [ ] Auto-complete when typing `[[` in editor
- [ ] Broken link detection and reporting
- [ ] Bulk link updates when renaming pages
- [ ] Graph view of page connections
- [ ] Link preview on hover
