---
"pstdio": patch
---

Keep Prompt Studio responsive while an extension writes in bulk. Core database work now goes ahead of queued extension work, extensions take turns, and long bursts pause regularly so health checks, cancellation and other requests are answered. An extension already running 256 commands gets an `extension_overloaded` rejection for new ones before they start.
