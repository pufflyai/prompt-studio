---
layout: ../../../layouts/docs-layout.astro
title: Review output and diffs
description: Read an agent transcript, inspect the diff, and mark the attempt review-ready.
htmlTitle: Review agent output
htmlDescription: Read the agent transcript, inspect the workspace diff, and set the attempt status to review-ready.
section: Guide
category: Daily Workflow
categoryOrder: 3
order: 6
---

## Read the transcript

Every session renders as a chat with the full tool timeline. You can:

- Scroll through the conversation and tool calls in the dashboard.
- Click any tool call to see its inputs and outputs.
- Follow the live stream via `pstdio sessions stream --id <session-id>` or `GET /v1/sessions/{id}/stream` (Server-Sent Events).

## Inspect the diff

The workspace view surfaces two diff panels:

- **Diff summary** — per-file stats, generated from `GET /v1/workspaces/{id}/diff-summary`.
- **Full diff** — the patch across the worktree's current branch vs base, from `GET /v1/workspaces/{id}/diff`.

Look for:

- Files you didn't expect to change.
- Accidentally committed secrets or large binary files.
- Missing tests or docs.

If you want to browse in your editor instead, open the worktree directly at the `worktree_path` shown in the workspace details.

## Mark the attempt

Attempts have their own status dimension. When you are happy with the diff, move the attempt to a review-ready status:

```bash
pstdio workspaces set-status --workspace PS-42_A1 --status review-ready
```

If your team wires a `pre` or `post` attempt-status-change hook, that hook runs here. Hooks can reject the transition if validation fails.

## Bump the ticket automatically

Once all attempts on a ticket reach the same status, you can roll the ticket forward:

```bash
pstdio tickets update-when-attempt-status \
  --id PS-42 \
  --all-attempts-status merged \
  --set-status done
```

This is also what plugin helpers like `updateTicketWhenAllAttemptsMatch` do.

## Related pages

- [Merge or clean up workspaces](/docs/workflows/merge-or-cleanup/) — the final step.
- [`pstdio workspaces` reference](/docs/reference/cli/workspaces/) — CLI options.
- [Hook reference](/docs/reference/sdk/hooks/) — the hooks that run on status changes.
