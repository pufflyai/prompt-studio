---
"pstdio": patch
---

Keep Prompt Studio responsive while an extension writes in bulk. Core reads and writes now go ahead of queued extension database work, extensions take turns, and long bursts pause regularly so health checks, cancellation and other requests are answered. An extension already running 256 commands gets a retryable `extension_overloaded` rejection for new ones.
