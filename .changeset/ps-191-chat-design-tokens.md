---
"@pstdio/ui": minor
"@pstdio/workbench": patch
"pstdio": patch
---

Migrate the chat UI to the latest design system. Sync the dark-mode neutral and status-border color tokens (and a new `bg.elevated`) to the Pencil source of truth and make the primary accent mode-independent; rebuild the composer so the model, attach, and send controls share one 28px row with the editor; move the workspace hub to wrap the composer with the workspace selector, an open-workspace icon action, and ready/setting-up/failed states; replace the "Working…" label with an elapsed-run-time indicator; and add a `ConversationBrowse` scrubber. Breaking: `ChatPanel`/`ChatInput` drop the `repoMenu` prop and `ChatWorkspaceHub` replaces `changesLabel` with `workspaceControl`.
