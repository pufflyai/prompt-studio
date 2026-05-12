---
"@pstdio/ui": patch
"pstdio": patch
---

Stop re-rendering the chat input and new ticket input on every keystroke by tracking text via refs and a single boolean instead of full string state.
