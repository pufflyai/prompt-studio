---
"pstdio": patch
---

Reduce repeated database reads when filtering resource views by breadcrumb.

Queue a new record save in one database write while preserving reserved identities and idempotent retries.
