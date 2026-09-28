---
"pstdio": patch
"@pstdio/ui": minor
---

Chat problems appear in the conversation instead of banners, a message that cannot be sent stays in the conversation as "Not sent", and Retry is offered only for temporary failures. `@pstdio/ui` adds `AlertMessage` `onClose`, `ChatPanel` `conversationNotices`, and the `delivery: "unsent"` message state.
