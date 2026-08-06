# Large-Scale Code Refactoring SOP

## Pre-refactor Checklist
- Understand scope: Identify the exact modules, files, and logic to be refactored.
- Backup/branch: Always ensure you are on a fresh branch before starting. Use git checkout -b.
- Identify dependencies: Check which modules depend on the code being refactored.

## Execution Strategy
- Batch by module, not by file type. Refactor a feature or component completely (including its tests) before moving to the next.
- Avoid modifying the whole codebase at once. Break it down into smaller, manageable chunks.

## Testing Gates
- Run tests every N changes (e.g., every 5-10 file modifications).
- Ensure existing tests pass before moving to the next module.

## Rollback Triggers
- If more than 3 tests fail unpredictably after a batch, revert the recent changes.
- If the build fails due to circular dependencies or unresolvable type errors, stop and revert.

## Progress Tracking
- Use the `todo_write` tool to maintain a checklist of modules to be refactored and track progress.

## Post-refactor Verification
- Run the full test suite.
- Ensure all CI/CD checks pass.
- Review any performance impacts.
