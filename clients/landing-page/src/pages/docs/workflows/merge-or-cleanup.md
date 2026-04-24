---
layout: ../../../layouts/docs-layout.astro
title: Merge or clean up workspaces
description: Squash-merge a successful attempt, or tear down worktrees when you're done.
htmlTitle: Merge or clean up workspaces
htmlDescription: Squash-merge a successful attempt back into your branch, or tear down its worktree when you're done.
section: Guide
category: Daily Workflow
categoryOrder: 3
order: 7
---

## Merge

Squash-merge a workspace into the current branch of the primary repo:

```bash
pstdio workspaces merge --id PS-42_A1
pstdio workspaces merge --id PS-42_A1 --delete-workspace
```

`--delete-workspace` also removes the workspace record and its worktree once the merge succeeds.

Hooks run around the merge:

- **`preMerge`** — can reject the merge (e.g. require review-ready status, block on failing checks).
- **`postMerge`** — react to a successful merge (e.g. bump ticket to `done`, post a Slack update).
- **`onConflict`** — fires if git reports a conflict during merge.

## Delete a workspace

Force-remove a workspace without merging:

```bash
pstdio workspaces delete --id PS-42_A1
```

This runs `preWorktreeRemove` and `postWorktreeRemove` hooks and removes the git worktree.

## Remove all worktrees for a ticket

After a ticket is done you might have several abandoned attempts. Drop all of them at once:

```bash
pstdio tickets worktrees list --id PS-42
pstdio tickets worktrees remove-all --id PS-42
```

## Archive instead of delete

If you want to keep the record for audit but take it out of active lists:

- Tickets — `pstdio tickets archive --id PS-42`.
- Sessions — `pstdio sessions archive --id <session-id>`.
- Workspaces — `POST /v1/workspaces/{id}/archive`.

## Related pages

- [Workspaces and worktrees](/docs/concepts/workspaces-and-worktrees/) — attempt model.
- [`pstdio workspaces` reference](/docs/reference/cli/workspaces/) and [`pstdio tickets worktrees`](/docs/reference/cli/tickets/#pstdio-tickets-worktrees).
- [Hook reference](/docs/reference/sdk/hooks/) — merge, worktree, commit hooks.
