/**
 * Git Service
 * High-level service for Git operations via Tauri backend
 */

import { invoke } from '@tauri-apps/api/core';
import { fileSystemService } from './fileSystemFactory';

export interface GitStatus {
  branch: string;
  modified_count: number;
  staged_count: number;
  ahead: number;
  behind: number;
  is_clean: boolean;
  modified_files: string[];
}

export interface GitCommitOptions {
  message: string;
  author_name: string;
  author_email: string;
}

export interface GitConfig {
  user_name: string;
  user_email: string;
  remote_url: string;
  remote_name: string;
  branch_name: string;
}

export class GitService {
  private autoCommitTimer: number | null = null;

  /**
   * Get workspace path from fileSystemService
   */
  private getWorkspacePath(): string {
    const rootHandle = fileSystemService.getRootHandle();

    // For Tauri, getRootHandle() returns the path as a string
    if (typeof rootHandle === 'string') {
      return rootHandle;
    }

    // For browser, we need to handle FileSystemDirectoryHandle
    // This shouldn't happen since Git is Tauri-only, but provide a fallback
    throw new Error('Git operations are only available in desktop mode');
  }

  /**
   * Check if Tauri is available
   */
  private isTauriAvailable(): boolean {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  }

  /**
   * Invoke a Git command via Tauri
   */
  private async invokeGitCommand<T>(command: string, args?: any): Promise<T> {
    if (!this.isTauriAvailable()) {
      throw new Error('Git operations require desktop mode');
    }

    try {
      return await invoke<T>(command, args);
    } catch (error) {
      // Transform error message for better UX
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(message);
    }
  }

  /**
   * Get the current Git status
   */
  async getStatus(): Promise<GitStatus> {
    const workspacePath = this.getWorkspacePath();
    return this.invokeGitCommand<GitStatus>('git_get_status', { workspacePath });
  }

  /**
   * Commit changes with the given message
   */
  async commit(options: GitCommitOptions): Promise<string> {
    const workspacePath = this.getWorkspacePath();
    return this.invokeGitCommand<string>('git_commit', { workspacePath, options });
  }

  /**
   * Push changes to remote
   */
  async push(remoteName?: string): Promise<void> {
    const workspacePath = this.getWorkspacePath();
    return this.invokeGitCommand<void>('git_push', { workspacePath, remoteName });
  }

  /**
   * Pull changes from remote
   */
  async pull(remoteName?: string): Promise<void> {
    const workspacePath = this.getWorkspacePath();
    return this.invokeGitCommand<void>('git_pull', { workspacePath, remoteName });
  }

  /**
   * Sync (pull then push)
   */
  async sync(remoteName?: string): Promise<void> {
    const workspacePath = this.getWorkspacePath();
    return this.invokeGitCommand<void>('git_sync', { workspacePath, remoteName });
  }

  /**
   * Check if workspace is a Git repository
   */
  async isRepository(): Promise<boolean> {
    try {
      if (!this.isTauriAvailable()) {
        console.log('GitService: Tauri not available, cannot check repository');
        return false;
      }

      const workspacePath = this.getWorkspacePath();
      console.log('GitService: Checking repository at path:', workspacePath);

      const result = await this.invokeGitCommand<boolean>('git_is_repository', { workspacePath });
      console.log('GitService: Repository check result:', result);

      return result;
    } catch (error) {
      console.error('GitService: Error checking repository:', error);
      return false;
    }
  }

  /**
   * Initialize a new Git repository
   */
  async initialize(config: GitConfig): Promise<void> {
    const workspacePath = this.getWorkspacePath();
    return this.invokeGitCommand<void>('git_initialize', { workspacePath, config });
  }

  /**
   * Start auto-commit with specified interval (in minutes)
   */
  startAutoCommit(intervalMinutes: number, commitOptions: GitCommitOptions): void {
    // Stop any existing auto-commit
    this.stopAutoCommit();

    const intervalMs = intervalMinutes * 60 * 1000;

    this.autoCommitTimer = window.setInterval(async () => {
      try {
        const status = await this.getStatus();

        // Only commit if there are changes
        if (!status.is_clean) {
          const timestamp = new Date().toISOString();
          const message = `Auto-commit: ${timestamp}`;

          await this.commit({
            ...commitOptions,
            message,
          });

          console.log(`Auto-committed at ${timestamp}`);
        }
      } catch (error) {
        console.error('Auto-commit failed:', error);
        // Don't stop the interval on error - just log it
      }
    }, intervalMs);

    console.log(`Auto-commit started with ${intervalMinutes} minute interval`);
  }

  /**
   * Stop auto-commit
   */
  stopAutoCommit(): void {
    if (this.autoCommitTimer !== null) {
      window.clearInterval(this.autoCommitTimer);
      this.autoCommitTimer = null;
      console.log('Auto-commit stopped');
    }
  }

  /**
   * Check if auto-commit is active
   */
  isAutoCommitActive(): boolean {
    return this.autoCommitTimer !== null;
  }

  /**
   * Check if Git LFS is available
   */
  async isLFSAvailable(): Promise<boolean> {
    if (!this.isTauriAvailable()) {
      return false;
    }

    try {
      return await this.invokeGitCommand<boolean>('git_lfs_available', {});
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const gitService = new GitService();
