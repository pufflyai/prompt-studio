---
"pstdio": patch
---

Stop the session queue from retrying work in a workspace whose archive or delete failed, cancel queued and running sessions when they or their workspace are archived or deleted, send `session.completed` for every finished session, keep the terminal title probe from blocking the API, and make `pst` fail on mistyped extension commands and missing or invalid option values.
