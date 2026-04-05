---
"pstdio": patch
"@pstdio/sdk": patch
---

Consolidate plugin runtime boundaries: introduce pstdio-api-contracts for shared API types, make SDK and API consume contracts, move hook dispatch into pstdio-plugins/hooks, delete pstdio-hooks
