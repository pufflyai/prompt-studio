---
"@pstdio/ui": minor
---

Remove obsolete chat agent runtime types from the UI package, narrow `SessionMessagePart` to the canonical API contract shape, and expose UI-only alerts through `ChatMessagePart`.

Downstream chat-ui consumers that previously rendered alert parts from `SessionMessagePart[]` should type those rendered parts as `ChatMessagePart[]` instead.

Use a repo-level Bun test preload for Lexical peer packages so `@lexical/markdown` initializes deterministically during validation.
