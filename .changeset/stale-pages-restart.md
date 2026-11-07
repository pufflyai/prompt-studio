---
"pstdio": patch
"@pstdio/workbench": patch
---

Paged tables and boards keep loading the next page when the data changed after the previous page, for example through sync, instead of showing "Query revision is stale".
