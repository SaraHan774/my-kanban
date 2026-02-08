import { describe, it, expect, beforeEach } from 'vitest';
import { FileSystemService } from '../fileSystem';
import { setupMockFileSystem } from '../../test/mocks/fileSystemAPI';

describe('FileSystemService', () => {
  let service: FileSystemService;

  beforeEach(() => {
    service = new FileSystemService();
    setupMockFileSystem();
  });

  it('should request and store directory handle', async () => {
    const handle = await service.requestDirectoryAccess();
    expect(handle).toBeDefined();
    expect(service.getRootHandle()).toBe(handle);
  });

  it('should read file content', async () => {
    await service.requestDirectoryAccess();
    const content = await service.readFile('workspace/Project A/index.md');
    expect(content).toContain('Project A');
  });

  it('should list directory entries', async () => {
    await service.requestDirectoryAccess();
    const entries = await service.listDirectory('workspace');
    expect(entries.some(e => e.name === 'Project A')).toBe(true);
  });

  it('should check existence correctly', async () => {
    await service.requestDirectoryAccess();
    expect(await service.exists('workspace/Project A/index.md')).toBe(true);
    expect(await service.exists('workspace/nope')).toBe(false);
  });

  it('should scan for pages with index.md', async () => {
    await service.requestDirectoryAccess();
    const pages = await service.scanPages('workspace');
    expect(pages).toContain('workspace/Project A');
    expect(pages).toContain('workspace/Project A/Task 1');
  });
});
