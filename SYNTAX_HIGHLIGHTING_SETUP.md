# Syntax Highlighting Setup

Syntax highlighting has been configured for code snippets in markdown content.

## Installation

Run the following command to install the required dependencies:

```bash
npm install
```

This will install:
- `highlight.js` - Syntax highlighting library
- `marked-highlight` - Integration between marked and highlight.js

## Configuration

The following changes have been made:

### 1. Dependencies Added
- `highlight.js@^11.9.0` - Core highlighting library
- `marked-highlight@^2.1.0` - Marked plugin for syntax highlighting

### 2. Markdown Service Updated
- Configured `marked` to use `highlight.js` for code blocks
- Auto-detects language from code fence (e.g., \`\`\`typescript)
- Falls back to plaintext for unknown languages

### 3. Theme Applied
- Using GitHub Dark theme (`github-dark.css`)
- Imported globally in `App.tsx`

## Available Themes

You can change the theme by modifying the import in `src/App.tsx`:

```typescript
// Current theme
import 'highlight.js/styles/github-dark.css';

// Other popular themes:
import 'highlight.js/styles/github.css';          // GitHub light
import 'highlight.js/styles/monokai.css';         // Monokai
import 'highlight.js/styles/atom-one-dark.css';   // Atom One Dark
import 'highlight.js/styles/vs2015.css';          // Visual Studio 2015
import 'highlight.js/styles/tomorrow-night-blue.css'; // Tomorrow Night
```

Browse all themes at: https://highlightjs.org/static/demo/

## Usage

Simply use fenced code blocks in your markdown:

\`\`\`typescript
function greet(name: string): string {
  return `Hello, ${name}!`;
}
\`\`\`

\`\`\`python
def greet(name: str) -> str:
    return f"Hello, {name}!"
\`\`\`

\`\`\`javascript
const greet = (name) => {
  return `Hello, ${name}!`;
};
\`\`\`

## Supported Languages

Highlight.js supports 190+ languages including:
- JavaScript, TypeScript
- Python, Java, C++, C#
- Go, Rust, Swift, Kotlin
- HTML, CSS, SCSS
- SQL, Bash, Shell
- JSON, YAML, Markdown
- And many more...

Full list: https://github.com/highlightjs/highlight.js/blob/main/SUPPORTED_LANGUAGES.md
