---
"pstdio": patch
---

Validate extension command params at the runtime trust boundary so invalid payloads return `rejected` outcomes instead of failing inside handler code.
