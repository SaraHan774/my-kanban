---
name: release-build
description: Validate build with tsc && vite build before release. Stops if build fails.
disable-model-invocation: true
allowed-tools: ["Bash"]
---

# Release Build Validation

This skill validates your build before creating a release, ensuring TypeScript compiles and Vite builds successfully.

## Workflow

1. **Run build validation**: Execute `npm run build` to check for errors
2. **Report results**: If build fails, stop and show detailed errors
3. **Proceed if successful**: Confirm build is ready for release

## Step-by-step instructions

### Step 1: Validate the build

Run the build command:

```bash
cd /Users/gahee/my-kanban && npm run build
```

**Wait for completion** and check the exit code.

### Step 2: Handle results

**If build FAILS** (exit code ≠ 0):
- **STOP immediately** - do NOT proceed
- Show the complete error output
- Identify the specific error (TypeScript error, build error, etc.)
- Point to the file and line number if available
- Suggest fixes if the error is clear
- **DO NOT run any git commands**

**If build SUCCEEDS** (exit code = 0):
- Confirm: "✅ Build validation passed"
- Show build output summary
- Inform user they can proceed with release steps
- Ask if they want to:
  - Create a git tag
  - Push to remote
  - Both

### Step 3: Optional release steps (only if build succeeded)

If user wants to tag:
```bash
cd /Users/gahee/my-kanban && git tag -a v[VERSION] -m "[MESSAGE]"
```

If user wants to push:
```bash
cd /Users/gahee/my-kanban && git push origin main --tags
```

## Key rules

- **Always use absolute paths**: `/Users/gahee/my-kanban`
- **Never skip build validation**: This is the primary purpose
- **Stop on any build error**: Do not proceed with git operations
- **Show full error context**: Include file paths, line numbers, error messages
- **Exit code matters**: Only exit code 0 means success
- **Be explicit**: Always confirm success or failure clearly

## Common errors to check for

1. **TypeScript errors**: `error TS####:` - show file:line and description
2. **Vite build errors**: Module not found, import errors
3. **Unused variables**: `is declared but its value is never read`
4. **Type errors**: Type mismatches, missing properties
5. **Missing dependencies**: Module resolution failures

## Success criteria

- ✅ `npm run build` exits with code 0
- ✅ No TypeScript compilation errors
- ✅ Vite build completes successfully
- ✅ All chunks generated
- ✅ PWA service worker generated (if applicable)
