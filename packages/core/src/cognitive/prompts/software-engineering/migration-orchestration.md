# Migration Orchestration SOP

## Overview
Use this SOP for large-scale migrations such as upgrading API versions, switching libraries, or porting to a new language.

## Scope Assessment
- Before starting, count the affected files. Use tools like `search_files` to find usages of the old API/library.

## Migration Checklist
- Create a comprehensive migration checklist using `todo_write`. List out the modules or features that need to be migrated.

## Execution Strategy
- Migrate incrementally, strictly one module at a time.
- Do not attempt a global find-and-replace unless it is completely safe.
- Verify each module's correctness (build and test) before moving to the next.
- Be extremely cautious of circular dependencies when migrating core modules.

## Checkpoints and Rollbacks
- Checkpoint strategy: Commit changes or save progress regularly after each successfully migrated module.
- Rollback: If a module's migration proves too complex or breaks the build heavily, use git to revert that specific module and re-evaluate.
