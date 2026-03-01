---
name: release-build
description: Complete release workflow - validates build, updates version, creates tag, and pushes to trigger deployment
disable-model-invocation: true
---

# Complete Release Workflow

This skill handles the complete release process: git checks, build validation, version updates, tagging, and deployment.

## Workflow Overview

1. **Pre-flight checks**: Verify git status and branch
2. **Build validation**: Run `npm run build` and check for errors
3. **Version update**: Update package.json version
4. **Git operations**: Commit, tag, and push
5. **Deployment reminder**: Check GitHub Secrets for Firebase

## Step-by-step instructions

### Step 1: Pre-flight Git Checks

Run these commands in sequence:

```bash
cd /Users/gahee/my-kanban && git status
```

**Check for:**
- ✅ On branch `main` (if not, warn and ask to switch)
- ✅ Working tree clean OR show uncommitted changes
- ✅ Up to date with origin (no unpushed commits warning is OK)

```bash
cd /Users/gahee/my-kanban && git log --oneline -3
```

Show recent commits for context.

**If working tree has uncommitted changes:**
- List the changed files
- Ask user if they want to commit them first or proceed anyway
- If user wants to commit, pause and let them describe changes
- **DO NOT proceed with release until user confirms**

### Step 2: Build Validation

Run the build command:

```bash
cd /Users/gahee/my-kanban && npm run build
```

**Wait for completion** and check the exit code.

**If build FAILS** (exit code ≠ 0):
- **STOP immediately** - do NOT proceed with ANY further steps
- Show the complete error output
- Identify the specific error:
  - TypeScript errors: `error TS####:` - show file:line and description
  - Vite build errors: Module not found, import errors
  - Type mismatches, missing properties
- Point to the file and line number if available
- Suggest fixes if the error is clear
- **DO NOT run any git commands**
- Tell user to fix errors and run `/release-build` again

**If build SUCCEEDS** (exit code = 0):
- Show: "✅ Build validation passed"
- Show build output summary (chunk sizes, warnings if any)
- Continue to Step 3

### Step 3: Version Update

Ask the user: "What version number for this release? (e.g., 0.5.3)"

**After user provides version:**

1. Read current package.json:
```bash
cd /Users/gahee/my-kanban && cat package.json | grep '"version"'
```

2. Update package.json with new version:
- Use Edit tool to replace version in package.json
- Change `"version": "X.Y.Z"` to `"version": "[USER_PROVIDED_VERSION]"`

3. Confirm the change:
```bash
cd /Users/gahee/my-kanban && git diff package.json
```

Show the diff to user and ask: "Version updated to [VERSION]. Proceed with commit and tag?"

**If user says no:** Stop here and exit
**If user says yes:** Continue to Step 4

### Step 4: Git Commit and Tag

Run these commands in sequence:

```bash
cd /Users/gahee/my-kanban && git add package.json
```

```bash
cd /Users/gahee/my-kanban && git commit -m "$(cat <<'EOF'
chore: bump version to [VERSION]

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

```bash
cd /Users/gahee/my-kanban && git tag v[VERSION]
```

```bash
cd /Users/gahee/my-kanban && git log --oneline -1
```

Show the commit and confirm tag was created.

### Step 5: Push to Trigger Release

Ask user: "Ready to push and trigger release workflow? This will:
- Push commit to main
- Push tag v[VERSION]
- Trigger GitHub Actions (Tauri build + Firebase deployment)"

**If user confirms YES:**

```bash
cd /Users/gahee/my-kanban && git push && git push origin v[VERSION]
```

Show push output and confirm both succeeded.

**If user says NO:**
- Inform: "Changes committed locally but not pushed. You can push later with:"
- Show: `git push && git push origin v[VERSION]`
- Exit skill

### Step 6: Deployment Checklist

After successful push, show this checklist:

```
✅ Release v[VERSION] triggered!

📋 Deployment Checklist:

1. Monitor GitHub Actions:
   https://github.com/SaraHan774/my-kanban/actions

2. Verify GitHub Secrets are configured (required for Firebase deployment):
   https://github.com/SaraHan774/my-kanban/settings/secrets/actions

   Required secrets:
   - VITE_FIREBASE_API_KEY
   - VITE_FIREBASE_AUTH_DOMAIN
   - VITE_FIREBASE_PROJECT_ID
   - VITE_FIREBASE_STORAGE_BUCKET
   - VITE_FIREBASE_MESSAGING_SENDER_ID
   - VITE_FIREBASE_APP_ID
   - VITE_FIREBASE_MEASUREMENT_ID
   - FIREBASE_SERVICE_ACCOUNT

3. Expected workflow steps:
   ✓ Create GitHub Release (draft)
   ✓ Build Tauri apps (macOS Intel + ARM)
   ✓ Build & deploy web app to Firebase Hosting
   ✓ Publish GitHub Release

4. After deployment:
   - Desktop apps: https://github.com/SaraHan774/my-kanban/releases
   - Web app: https://mykanban-5beb2.web.app
```

## Key Rules

- **Always use absolute paths**: `/Users/gahee/my-kanban`
- **Stop on build errors**: Never proceed past failed builds
- **Ask before destructive operations**: Confirm before pushing
- **Show full error context**: File paths, line numbers, error messages
- **Exit code matters**: Only exit code 0 means success
- **Version format**: Use semantic versioning (X.Y.Z)

## Common Errors to Check For

1. **TypeScript errors**: `error TS####:` - show file:line and description
2. **Vite build errors**: Module not found, import errors
3. **Environment variables**: Missing VITE_ prefixed variables
4. **Git errors**: Conflicts, untracked files, wrong branch
5. **Version conflicts**: Tag already exists

## Emergency Rollback

If something goes wrong after pushing:

```bash
# Delete remote tag
git push origin :refs/tags/v[VERSION]

# Delete local tag
git tag -d v[VERSION]

# Revert version bump commit
git revert HEAD
git push
```

## Success Criteria

- ✅ On `main` branch
- ✅ Working tree clean (or user confirmed uncommitted changes)
- ✅ `npm run build` exits with code 0
- ✅ No TypeScript compilation errors
- ✅ Vite build completes successfully
- ✅ package.json version updated
- ✅ Changes committed with proper message
- ✅ Tag created: v[VERSION]
- ✅ Pushed to remote
- ✅ GitHub Actions workflow triggered
