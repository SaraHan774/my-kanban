import { useRef, useEffect, useState } from 'react';
import Editor from '@toast-ui/editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import './ToastEditor.css';
import { SlashCommandMenu } from './SlashCommandMenu';
import mermaid from 'mermaid';

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

export interface ToastEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  onImageUpload?: (file: File) => Promise<string>;
  editable?: boolean;
  height?: string;
}

export function ToastEditor({
  content,
  onChange,
  onImageUpload,
  editable = true,
  height = '600px',
}: ToastEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<Editor | null>(null);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });

  // Initialize editor
  useEffect(() => {
    if (!editorRef.current) return;

    const editor = new Editor({
      el: editorRef.current,
      initialValue: content,
      previewStyle: 'vertical',
      height,
      initialEditType: 'markdown',
      useCommandShortcut: true,
      usageStatistics: false,
      hideModeSwitch: false,
      autofocus: false,
      placeholder: 'Type / for commands...',
      // plugins: [], // Removed mermaidPlugin, will handle Mermaid rendering via events
      hooks: {
        addImageBlobHook: async (blob: File | Blob, callback: (url: string, alt: string) => void) => {
          if (!onImageUpload) {
            callback('', '');
            return;
          }

          try {
            const file = blob instanceof File ? blob : new File([blob], 'image.png');
            const imagePath = await onImageUpload(file);
            callback(imagePath, '');
          } catch (error) {
            console.error('Image upload failed:', error);
            callback('', '');
          }
        },
      },
      events: {
        change: () => {
          if (editorInstanceRef.current) {
            const markdown = editorInstanceRef.current.getMarkdown();
            onChange(markdown);
          }
        },
      },
      toolbarItems: [
        ['heading', 'bold', 'italic', 'strike'],
        ['hr', 'quote'],
        ['ul', 'ol', 'task', 'indent', 'outdent'],
        ['table', 'image', 'link'],
        ['code', 'codeblock'],
      ],
    });

    editorInstanceRef.current = editor;

    // Mermaid diagram rendering
    const renderMermaidDiagrams = () => {
      const previewPanel = editorRef.current?.querySelector('.toastui-editor-md-preview');

      if (!previewPanel) return;

      // Find all code blocks and check if they're mermaid
      const allCodeBlocks = previewPanel.querySelectorAll('pre code');
      const mermaidBlocks: Element[] = [];

      allCodeBlocks.forEach((block) => {
        const pre = block.parentElement as HTMLElement;
        const code = block.textContent || '';

        // Check if parent <pre> has data-language="mermaid"
        const dataLang = pre?.getAttribute('data-language');

        // Or check if code starts with common mermaid syntax
        const isMermaidSyntax = code.trim().match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|mindmap|timeline|journey|C4Context)/);

        if (dataLang === 'mermaid' || isMermaidSyntax) {
          mermaidBlocks.push(block);
        }
      });

      mermaidBlocks.forEach((block, index) => {
        const code = block.textContent || '';
        const pre = block.parentElement;

        if (!pre || pre.tagName !== 'PRE') return;

        // Skip if already rendered
        if (pre.hasAttribute('data-mermaid-rendered')) return;

        const id = `mermaid-diagram-${index}-${Date.now()}`;

        // Mark as being rendered to avoid re-rendering
        pre.setAttribute('data-mermaid-rendered', 'true');
        pre.classList.add('mermaid-diagram');

        // Render the diagram
        mermaid.render(id, code).then((result) => {
          // Replace the content but keep the <pre> element
          pre.innerHTML = result.svg;
        }).catch((error) => {
          console.error('Mermaid rendering error:', error);
          pre.removeAttribute('data-mermaid-rendered');
        });
      });
    };

    // Wiki links rendering
    const renderWikiLinks = () => {
      const previewPanel = editorRef.current?.querySelector('.toastui-editor-md-preview');
      if (!previewPanel) return;

      // Find all text nodes and convert [[Page Title]] to links
      const walker = document.createTreeWalker(
        previewPanel,
        NodeFilter.SHOW_TEXT,
        null
      );

      const nodesToReplace: { node: Node; parent: Node }[] = [];
      let currentNode = walker.nextNode();

      while (currentNode) {
        const text = currentNode.textContent || '';
        if (text.includes('[[') && text.includes(']]')) {
          nodesToReplace.push({ node: currentNode, parent: currentNode.parentNode! });
        }
        currentNode = walker.nextNode();
      }

      nodesToReplace.forEach(({ node, parent }) => {
        const text = node.textContent || '';
        const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;

        if (wikiLinkRegex.test(text)) {
          // Create a temporary container
          const container = document.createElement('span');
          container.innerHTML = text.replace(wikiLinkRegex, (_match, title) => {
            const pageId = title.toLowerCase().replace(/\s+/g, '-');
            return `<a href="#/page/${pageId}" class="wiki-link" data-wiki-link="${title}">${title}</a>`;
          });

          // Replace the text node with the new content
          while (container.firstChild) {
            parent.insertBefore(container.firstChild, node);
          }
          parent.removeChild(node);
        }
      });
    };

    // Render Mermaid diagrams and Wiki links on content change
    editor.on('change', () => {
      setTimeout(() => {
        renderMermaidDiagrams();
        renderWikiLinks();
      }, 100);
    });

    // Initial render
    setTimeout(() => {
      renderMermaidDiagrams();
      renderWikiLinks();
    }, 500);

    // Slash command detection
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/') {
        // Small delay to ensure "/" is inserted before showing menu
        setTimeout(() => {
          const editorEl = editorRef.current;
          if (!editorEl) return;

          // Get cursor position from editor
          const mdEditor = editorEl.querySelector('.toastui-editor-md-container');
          if (!mdEditor) return;

          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) return;

          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          // Position menu below cursor
          setSlashMenuPosition({
            top: rect.bottom + window.scrollY + 5,
            left: rect.left + window.scrollX,
          });
          setShowSlashMenu(true);
        }, 10);
      } else if (e.key === 'Escape') {
        setShowSlashMenu(false);
      }
    };

    // Add event listener to editor's markdown area
    const mdEditor = editorRef.current.querySelector('.toastui-editor-md-container');
    if (mdEditor) {
      mdEditor.addEventListener('keydown', handleKeyDown as any);
    }

    // Cleanup
    return () => {
      if (mdEditor) {
        mdEditor.removeEventListener('keydown', handleKeyDown as any);
      }
      if (editorInstanceRef.current) {
        editorInstanceRef.current.destroy();
        editorInstanceRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Update content when page changes
  useEffect(() => {
    if (editorInstanceRef.current) {
      const currentContent = editorInstanceRef.current.getMarkdown();

      // Only update if content is different to avoid cursor issues
      if (currentContent !== content) {
        editorInstanceRef.current.setMarkdown(content, false);
      }
    }
  }, [content]);

  // Handle slash command insertion
  const handleCommandInsert = (commandText: string) => {
    if (!editorInstanceRef.current) return;

    // Get current markdown content
    const markdown = editorInstanceRef.current.getMarkdown();

    // Remove the "/" character that triggered the menu
    const lines = markdown.split('\n');
    const lastLineIndex = lines.length - 1;
    const lastLine = lines[lastLineIndex];

    if (lastLine.endsWith('/')) {
      lines[lastLineIndex] = lastLine.slice(0, -1) + commandText;
    } else {
      lines[lastLineIndex] = lastLine + commandText;
    }

    const newMarkdown = lines.join('\n');
    editorInstanceRef.current.setMarkdown(newMarkdown, false);

    // Move cursor to end
    editorInstanceRef.current.focus();

    setShowSlashMenu(false);
  };

  const handleCloseMenu = () => {
    setShowSlashMenu(false);
  };

  return (
    <>
      <div ref={editorRef} className="toast-editor-wrapper" />
      {showSlashMenu && (
        <SlashCommandMenu
          position={slashMenuPosition}
          onCommand={handleCommandInsert}
          onClose={handleCloseMenu}
        />
      )}
    </>
  );
}
