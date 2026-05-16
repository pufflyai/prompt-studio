---
"pstdio": minor
"@pstdio/sdk": minor
---

PS-295: SDK `followupSession` queues follow-ups against active sessions instead of failing. `POST /sessions/{id}/follow-up` now returns 200 with a `follow_up: { status, queue_position? }` envelope, allows multiple pending entries per session dispatched FIFO after each terminal transition, and the plugin dispatcher logs swallowed post-hook rejections.
