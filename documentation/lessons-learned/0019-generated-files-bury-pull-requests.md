# Generated Files Bury Pull Requests

## What

PR #1577 moved the performance widget into an extension. Its real change was about 3,300 added and 1,840 removed lines. The PR showed 12,007 added and 10,526 removed lines in 1,870 files, because it also committed the regenerated Canvas preview catalog: 877 new and 876 deleted content-hashed modules in `extensions/canvas/src/catalog/generated/frame-modules/`, plus a 7,200-line manifest change. Reviewers could not find the real change.

## Why

- **Hashed names cascade.** Each preview module imports shared chunks by hashed file name. A change to a shared chunk, such as a `@pstdio/ui` theme recipe, gives it a new name, which changes every module that imports it, which gives each of those a new name too.
- **A check required the files.** `native-preview-freshness.p0.test.ts` fails when the committed catalog is stale, so the agent regenerated and committed it to make CI pass.
- **No rule said otherwise.** Nothing in the repository rules told agents not to commit generated output.

## Prevention

- Never commit generated files. Only the exceptions in [Generated files](../../AGENTS.md#generated-files) may be committed.
- Before every commit, check `git diff --cached --stat` for generated paths and unstage them.
- When a check demands a generated file, report the check instead of committing the file. A check that requires committed generated output is a design problem to fix (PS-985 for the Canvas catalog), not a reason to commit it.
