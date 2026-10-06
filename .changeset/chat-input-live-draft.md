---
"@pstdio/ui": patch
---

`ChatInput` no longer reports its seed through `onChange`, and adopts `defaultState` only when its text differs from the editor, so hosts can pass their live draft.
