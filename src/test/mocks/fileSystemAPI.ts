import { vi } from 'vitest';

/**
 * In-memory mock for FileSystemFileHandle (browser API).
 */
export class MockFileSystemFileHandle {
  readonly kind = 'file' as const;
  name: string;
  private content: string;

  constructor(name: string, content: string = '') {
    this.name = name;
    this.content = content;
  }

  async getFile() {
    const content = this.content;
    return {
      name: this.name,
      type: 'text/plain',
      text: async () => content,
      arrayBuffer: async () => new TextEncoder().encode(content).buffer,
    };
  }

  async createWritable() {
    const handle = this;
    return {
      write: vi.fn(async (data: string) => { handle.content = data; }),
      close: vi.fn(async () => {}),
    };
  }

  // Test helpers
  setContent(content: string) { this.content = content; }
  getContent() { return this.content; }
}

/**
 * In-memory mock for FileSystemDirectoryHandle (browser API).
 */
export class MockFileSystemDirectoryHandle {
  readonly kind = 'directory' as const;
  name: string;
  private entries: Map<string, MockFileSystemFileHandle | MockFileSystemDirectoryHandle>;

  constructor(name: string = 'root') {
    this.name = name;
    this.entries = new Map();
  }

  async getFileHandle(name: string, options?: { create?: boolean }) {
    const existing = this.entries.get(name);
    if (existing && existing.kind === 'file') return existing as MockFileSystemFileHandle;
    if (!options?.create) throw new DOMException('File not found', 'NotFoundError');
    const file = new MockFileSystemFileHandle(name);
    this.entries.set(name, file);
    return file;
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    const existing = this.entries.get(name);
    if (existing && existing.kind === 'directory') return existing as MockFileSystemDirectoryHandle;
    if (!options?.create) throw new DOMException('Directory not found', 'NotFoundError');
    const dir = new MockFileSystemDirectoryHandle(name);
    this.entries.set(name, dir);
    return dir;
  }

  async removeEntry(name: string, _options?: { recursive?: boolean }) {
    if (!this.entries.has(name)) throw new DOMException('Entry not found', 'NotFoundError');
    this.entries.delete(name);
  }

  async *values() {
    for (const entry of this.entries.values()) yield entry;
  }

  // Test helpers
  addFile(name: string, content: string = ''): MockFileSystemFileHandle {
    const file = new MockFileSystemFileHandle(name, content);
    this.entries.set(name, file);
    return file;
  }

  addDirectory(name: string): MockFileSystemDirectoryHandle {
    const dir = new MockFileSystemDirectoryHandle(name);
    this.entries.set(name, dir);
    return dir;
  }

  getEntry(name: string) { return this.entries.get(name); }
  clear() { this.entries.clear(); }
}

/**
 * Set up a pre-populated mock file system for tests.
 * Returns handles to key directories for easy test setup.
 */
export function setupMockFileSystem() {
  const root = new MockFileSystemDirectoryHandle('test-root');
  const workspace = root.addDirectory('workspace');

  const projectA = workspace.addDirectory('Project A');
  projectA.addFile('index.md', `---
id: "proj-a-id"
title: "Project A"
tags: ["project", "active"]
createdAt: "2024-01-01T00:00:00.000Z"
updatedAt: "2024-01-01T00:00:00.000Z"
viewType: "document"
---

# Project A

This is project A content.
`);

  const task1 = projectA.addDirectory('Task 1');
  task1.addFile('index.md', `---
id: "task-1-id"
title: "Task 1"
tags: ["todo"]
createdAt: "2024-01-02T00:00:00.000Z"
updatedAt: "2024-01-02T00:00:00.000Z"
viewType: "document"
kanbanColumn: "todo"
---

# Task 1

Task details here.
`);

  // Inject showDirectoryPicker into global
  (globalThis as any).showDirectoryPicker = vi.fn(async () => root);

  return { root, workspace, projectA, task1 };
}
