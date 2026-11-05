---
"pstdio-planner": patch
---

Auto Build skips starting an attempt when this device's workspace limit is full and checks live capacity on the next dispatch. Sessions in an already active workspace can share its slot, while Planner's ticket concurrency setting stays unchanged.
