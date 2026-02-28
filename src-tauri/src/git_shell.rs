use std::process::Command;
use std::time::Duration;
use wait_timeout::ChildExt;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct GitCommitOptions {
    pub message: String,
    pub author_name: String,
    pub author_email: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitConfig {
    pub user_name: String,
    pub user_email: String,
    pub remote_url: String,
    pub remote_name: String,
    pub branch_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitStatus {
    pub branch: String,
    pub modified_count: usize,
    pub staged_count: usize,
    pub ahead: usize,
    pub behind: usize,
    pub is_clean: bool,
    pub modified_files: Vec<String>,
}

/// Execute a git command with timeout
fn run_git_command(workspace_path: &str, args: &[&str], timeout_secs: u64) -> Result<String, String> {
    // Only log important commands (not status checks)
    let is_status_check = args.contains(&"status") || args.contains(&"rev-parse") || args.contains(&"rev-list");
    if !is_status_check {
        eprintln!("[Git Shell] Running: git {}", args.join(" "));
    }

    let mut child = Command::new("git")
        .args(args)
        .current_dir(workspace_path)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to execute git: {}. Make sure Git is installed.", e))?;

    // Wait with timeout
    let timeout = Duration::from_secs(timeout_secs);
    match child.wait_timeout(timeout).map_err(|e| format!("Error waiting for git: {}", e))? {
        Some(status) => {
            let output = child.wait_with_output()
                .map_err(|e| format!("Failed to read git output: {}", e))?;

            if status.success() {
                if !is_status_check {
                    eprintln!("[Git Shell] ✓ Command succeeded");
                }
                Ok(String::from_utf8_lossy(&output.stdout).to_string())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                // Don't log "no upstream" errors - they're expected
                if !stderr.contains("no upstream configured") {
                    eprintln!("[Git Shell] ✗ Command failed: {}", stderr);
                }
                Err(stderr.to_string())
            }
        }
        None => {
            // Timeout - kill the process
            child.kill().ok();
            eprintln!("[Git Shell] ✗ Command timed out after {} seconds", timeout_secs);
            Err(format!("Git operation timed out after {} seconds", timeout_secs))
        }
    }
}

#[tauri::command]
pub async fn git_push(workspace_path: String, remote_name: Option<String>) -> Result<(), String> {
    let remote = remote_name.unwrap_or_else(|| "origin".to_string());

    // Get current branch
    let branch = run_git_command(&workspace_path, &["branch", "--show-current"], 5)?;
    let branch = branch.trim();

    // Check if upstream is set
    let has_upstream = run_git_command(&workspace_path, &["rev-parse", "--abbrev-ref", &format!("{}@{{u}}", branch)], 5).is_ok();

    // Push with -u flag if no upstream, otherwise just push
    if has_upstream {
        run_git_command(&workspace_path, &["push", &remote, branch], 30)?;
    } else {
        eprintln!("[Git Shell] No upstream set, using -u flag to set tracking");
        run_git_command(&workspace_path, &["push", "-u", &remote, branch], 30)?;
    }

    Ok(())
}

#[tauri::command]
pub async fn git_pull(workspace_path: String, remote_name: Option<String>) -> Result<(), String> {
    let remote = remote_name.unwrap_or_else(|| "origin".to_string());

    // Get current branch
    let branch = run_git_command(&workspace_path, &["branch", "--show-current"], 5)?;
    let branch = branch.trim();

    // Pull with branch name
    run_git_command(&workspace_path, &["pull", &remote, branch], 30)?;
    Ok(())
}

#[tauri::command]
pub async fn git_commit(workspace_path: String, options: GitCommitOptions) -> Result<String, String> {
    // Configure user if needed
    run_git_command(&workspace_path, &["config", "user.name", &options.author_name], 5)?;
    run_git_command(&workspace_path, &["config", "user.email", &options.author_email], 5)?;

    // Stage all changes
    run_git_command(&workspace_path, &["add", "-A"], 10)?;

    // Commit
    run_git_command(&workspace_path, &["commit", "-m", &options.message], 10)?;

    // Get commit hash
    let hash = run_git_command(&workspace_path, &["rev-parse", "HEAD"], 5)?;
    Ok(hash.trim().to_string())
}

#[tauri::command]
pub async fn git_initialize(workspace_path: String, config: GitConfig) -> Result<(), String> {
    eprintln!("[Git Init] Initializing repository at: {}", workspace_path);

    // Initialize repo
    run_git_command(&workspace_path, &["init"], 5)?;

    // Configure user
    run_git_command(&workspace_path, &["config", "user.name", &config.user_name], 5)?;
    run_git_command(&workspace_path, &["config", "user.email", &config.user_email], 5)?;

    // Set up Git LFS for images
    eprintln!("[Git Init] Setting up Git LFS for images...");
    match run_git_command(&workspace_path, &["lfs", "install"], 5) {
        Ok(_) => {
            eprintln!("[Git Init] ✓ Git LFS installed");

            // Track workspace/.images folder with LFS (images are at workspace/.images/)
            match run_git_command(&workspace_path, &["lfs", "track", "workspace/.images/**"], 5) {
                Ok(_) => {
                    eprintln!("[Git Init] ✓ Configured LFS to track workspace/.images/**");

                    // Add .gitattributes file
                    run_git_command(&workspace_path, &["add", ".gitattributes"], 5).ok();
                }
                Err(e) => {
                    eprintln!("[Git Init] ⚠ Warning: Could not configure LFS tracking: {}", e);
                }
            }
        }
        Err(e) => {
            eprintln!("[Git Init] ⚠ Warning: Git LFS not available: {}", e);
            eprintln!("[Git Init] Images will be stored in Git directly (may increase repo size)");
            eprintln!("[Git Init] Install Git LFS with: brew install git-lfs");
        }
    }

    // Create initial commit (includes .gitattributes if LFS setup succeeded)
    run_git_command(&workspace_path, &["add", "-A"], 10)?;
    run_git_command(&workspace_path, &["commit", "-m", "Initial commit"], 10)?;

    // Rename branch to main/master
    run_git_command(&workspace_path, &["branch", "-M", &config.branch_name], 5)?;

    // Add remote and push if URL provided
    if !config.remote_url.is_empty() {
        eprintln!("[Git Init] Adding remote: {}", config.remote_url);
        run_git_command(&workspace_path, &["remote", "add", &config.remote_name, &config.remote_url], 5)?;

        eprintln!("[Git Init] Pushing to remote...");
        run_git_command(&workspace_path, &["push", "-u", &config.remote_name, &config.branch_name], 30)?;

        eprintln!("[Git Init] ✓ Repository initialized and pushed successfully");
    } else {
        eprintln!("[Git Init] ✓ Repository initialized (no remote configured)");
    }

    Ok(())
}

#[tauri::command]
pub async fn git_get_status(workspace_path: String) -> Result<GitStatus, String> {
    // Get current branch
    let branch_output = run_git_command(&workspace_path, &["branch", "--show-current"], 5)?;
    let branch = branch_output.trim().to_string();

    // Get status in porcelain format
    let status_output = run_git_command(&workspace_path, &["status", "--porcelain"], 5)?;

    let mut modified_count = 0;
    let mut staged_count = 0;
    let mut modified_files = Vec::new();

    for line in status_output.lines() {
        if line.is_empty() {
            continue;
        }

        // Porcelain format: XY filename
        // X = staged status, Y = unstaged status
        let chars: Vec<char> = line.chars().collect();
        if chars.len() < 3 {
            continue;
        }

        let staged_char = chars[0];
        let unstaged_char = chars[1];
        let filename = line[3..].to_string();

        modified_files.push(filename);

        // Check if staged
        if staged_char != ' ' && staged_char != '?' {
            staged_count += 1;
        }

        // Check if modified (unstaged)
        if unstaged_char != ' ' {
            modified_count += 1;
        }
    }

    // Get ahead/behind counts
    let (ahead, behind) = match run_git_command(&workspace_path, &["rev-list", "--left-right", "--count", "HEAD...@{u}"], 5) {
        Ok(output) => {
            let parts: Vec<&str> = output.trim().split_whitespace().collect();
            if parts.len() >= 2 {
                let ahead = parts[0].parse().unwrap_or(0);
                let behind = parts[1].parse().unwrap_or(0);
                (ahead, behind)
            } else {
                (0, 0)
            }
        }
        Err(_) => (0, 0), // No upstream branch set
    };

    Ok(GitStatus {
        branch,
        modified_count,
        staged_count,
        ahead,
        behind,
        is_clean: modified_count == 0 && staged_count == 0,
        modified_files,
    })
}

#[tauri::command]
pub async fn git_sync(workspace_path: String, remote_name: Option<String>) -> Result<(), String> {
    let remote = remote_name.unwrap_or_else(|| "origin".to_string());

    // Get current branch
    let branch = run_git_command(&workspace_path, &["branch", "--show-current"], 5)?;
    let branch = branch.trim();

    // Pull first
    run_git_command(&workspace_path, &["pull", &remote, branch], 30)?;
    // Then push
    run_git_command(&workspace_path, &["push", &remote, branch], 30)?;
    Ok(())
}

#[tauri::command]
pub async fn git_is_repository(workspace_path: String) -> Result<bool, String> {
    match run_git_command(&workspace_path, &["rev-parse", "--git-dir"], 5) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn git_lfs_available() -> Result<bool, String> {
    // Check if git-lfs is installed
    match Command::new("git")
        .args(&["lfs", "version"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
    {
        Ok(status) => Ok(status.success()),
        Err(_) => Ok(false),
    }
}
