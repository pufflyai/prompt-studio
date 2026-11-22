---
"planner": patch
---

Preserve pending ticket order when moving or creating Timeline tickets before the Timeline has been opened. Skip dependency delivery history reads when no completed dependency has a pull request to inspect, and avoid repeated attempt queries for unstarted Auto Build candidates.
