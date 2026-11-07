---
"pstdio-session-browser": patch
"pstdio": patch
"@pstdio/workbench": patch
---

Keep forking beside individual messages rather than in the session dropdown, and allow the generic Side-panel bubble to open without the Sessions provider.

Preserve Main command-palette session status colors and offer local message forks without preemptive harness capability gating; drafts and remote sessions do not expose fork.

Apply installed navigation trees' default node expansion using provider-scoped IDs, while preserving later user collapse choices.
