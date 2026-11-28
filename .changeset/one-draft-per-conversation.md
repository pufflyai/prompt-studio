---
"pstdio": minor
"@pstdio/sdk": minor
"@pstdio/workbench": minor
---

Keep one unsent draft per conversation, without restore prompts. The draft survives switching conversations, reloading and, in the desktop app, restarting. A failed send puts its text back in the box.

Native chat no longer synchronizes or recovers drafts. `ChatDraft.recovered`, `browserDraft.acknowledgeRecovery`, `legacySessionDraft` and the `draftClientId` action parameter are removed. Declare `browserDraft: {}` to let the host keep the draft. Extensions that still declare `legacySessionDraft` or `acknowledgeRecovery` keep loading; those fields are ignored.
