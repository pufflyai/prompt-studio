---
"pstdio": patch
---

`pst` no longer starts a local API when `PSTDIO_API_URL` points at another machine that is down, and every CLI request uses the same default API address.
