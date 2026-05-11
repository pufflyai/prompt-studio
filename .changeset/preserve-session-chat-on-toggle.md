---
"pstdio": patch
---

Preserve the `SessionChatView` instance when toggling between the attached panel and the floating bubble, so the chat no longer rebuilds (virtualizer, chat input, session stream) on every detach/attach. The chat is hosted in a single stable DOM node that is moved between the two chrome slots via `appendChild`, keeping its React state and message viewport intact across the switch.
