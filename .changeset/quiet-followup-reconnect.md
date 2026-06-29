---
"pstdio": patch
"@pstdio/ui": patch
---

Stop the chat panel from blanking and remounting on follow-up submit. The session messages hook now preserves the rendered conversation across same-session reconnects, and the message animation hook is StrictMode-safe so the optimistic fade-in doesn't get silently dropped.
