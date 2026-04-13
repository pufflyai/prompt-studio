---
"pstdio": patch
"@pstdio/sdk": patch
---

Fix `pstdio tickets save` failing with opaque `[object Object]` errors when the ticket had a `blocked_reason` frontmatter field, and surface zod validation errors in the SDK client instead of stringifying them.
