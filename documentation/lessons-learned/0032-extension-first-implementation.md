# Keep extension workflows in extensions

## 1. When to use

- Implementing a fix whose request does not specify which layer should change.
- Considering a core schema, host constraint, or platform API change for an extension workflow.

## 2. Failure

- A bug fix asked for Planner attempts to run in projects without Git.
- Planner stored attempt records in its own extension storage, but identified an attempt by its isolated workspace ID.
- The first solution created another host workspace record for each attempt, pointing at the existing project folder. The host correctly rejected duplicate active folder paths.
- Instead of separating Planner's attempt identity from its execution workspace, the implementation proposed weakening that core uniqueness constraint. Drizzle generated a 6,516-line schema snapshot, and work stopped for size approval.
- The migration addressed a consequence of the chosen extension model. It was unnecessary for running an agent in the project's existing workspace. The core changes and approval request were withdrawn.

## 3. Prevention

- Start with the owning extension's commands, records and public API calls. Keep domain identity and workflow state in that extension.
- Distinguish a workflow record from the host resource it uses: several Planner attempts can reference one execution workspace.
- Prefer an extension solution. Change core only when a general workbench capability is missing, and state that capability before coding.
- Treat a core migration or relaxed host invariant proposed for one extension as a reason to revisit ownership.
- Follow [Engineering 006.2.17 and 006.3.8](../guidance/0006-engineering.md).

## 4. Evidence

- [Planner attempt storage](../../extensions/pstdio-planner/src/data/attempt-storage.ts)
- [Planner attempt identity](../../extensions/pstdio-planner/src/data/attempt-identity.ts)
- [Project-folder attempt regressions](../../extensions/pstdio-planner/src/commands/folder-attempt.p0.test.ts)
