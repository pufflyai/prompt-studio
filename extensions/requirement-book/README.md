# Requirement book

A working local prototype for PS-104. Install it in an isolated Git project to try the workflow before migrating existing requirements.

```sh
pst extensions add /absolute/path/to/extensions/requirement-book --force
pst workspaces create --provider pstdio.worktree --params '{"base":"main"}'
pst pstdio.requirement-book workspace select --workspace-id <workspace-id>
pst pstdio.requirement-book initialize --title "Product behavior"
pst pstdio.requirement-book open
```

The dashboard provides chapter and rule browsing, search, rule authoring, amendment, movement and removal, exact suggestion comparisons, local review, reconciliation and application to a working branch. Findings and qualified observations have independent read states. Observations can map to multiple requirements or propose a new rule.

The sole requirement authority is `documentation/requirement-book/book.json` in Git. The accepted view reads the configured local target branch; the working view reads the selected workspace. The extension refuses writes to the default project folder or accepted branch. Applying never commits, creates a PR, merges, or accepts a proposal. Existing repository review remains the acceptance boundary.

Small project records hold suggestions, authoring drafts, observations, findings, and read markers. They do not contain a second accepted book. New-rule forms retain drafts on field blur, Cancel, and Escape; the close button discards the draft. Failed actions remain visible. Pending applications retain a recovery journal; retry Apply after a failed final metadata save. `suggestions cancel-application` clears an unapplied attempt only when the file still matches its exact prior content.

Use `pst pstdio.requirement-book --help` for the same actions from an agent. `read` searches with `--query`; `get --reference 'RB 1.A.1'` retrieves exact intent and evidence. `suggest` accepts an operations array with ADD, AMEND, MOVE, or REMOVE; each operation carries explicit `before` and `after` values. Updates to an existing suggestion clear local review. Removed identities are retired permanently. Generated rule references use collision-resistant identities rather than an extension-owned sequential counter.

Focused checks compare source hashes and identify missing recorded measurements. They run after registered Git/session/project events and on the host schedule. They do not execute tests, infer complete semantics, or prove compliance. Assertions remain assertions; a linked test path is not an execution result. Evidence records preserve the source revision, conditions, limits, and many-to-many mappings. Retired-only mappings return observations to Undocumented without deleting their history.

The prototype does not migrate this repository's requirements or replace its guidance. `initialize` rejects repositories that still contain tracked legacy requirements, so adoption needs one atomic migration. The example project is disposable sample intent, not Prompt Studio product policy. Accepted-target configuration supports existing local branch names only.

Checks:

```sh
bun test
bun run typecheck
pst extensions check /absolute/path/to/extensions/requirement-book
pst extensions test /absolute/path/to/extensions/requirement-book
```
