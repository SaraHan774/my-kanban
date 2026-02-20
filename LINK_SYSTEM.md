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

**Example:**
```markdown
[[550e8400-e29b-41d4-a716-446655440000|My Project]]
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
1. Wiki link syntax `[[...]]` is detected
2. Links are converted to HTML: `<a class="page-link" data-page-id="..." href="#">Display Text</a>`
3. ID-based links use `data-page-id` attribute
4. Title-based links use `data-page-ref` attribute

### Navigation (click handling)
1. Click handler detects `data-page-id` or `data-page-ref`
2. For ID-based: Direct lookup by ID (fast, reliable)
3. For title-based: Scan all pages to find matching title (slower, case-insensitive)
4. Navigate to `/page/{id}`

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

### Link Service (`src/services/linkService.ts`)
```typescript
// Parse wiki links from markdown
parseLinks(content: string): ParsedLink[]

// Resolve page reference to ID
resolvePageRef(ref: string, isIdBased: boolean): Promise<string | null>

// Get backlinks (pages that link to this page)
getBacklinks(pageId: string): Promise<Backlink[]>

// Validate link
validateLink(targetRef: string, isIdBased: boolean): Promise<LinkValidation>
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
