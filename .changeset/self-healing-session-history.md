---
"pstdio": patch
"@pstdio/sdk": minor
---

Sessions no longer become read-only when saved and agent history disagree: history reconciles with the saved conversation winning, and the "Conversation cannot continue" banner, `SessionHistoryIssue`, and `onHistoryIssue` are removed.
