---
"planner": patch
---

Preserve pending ticket order when moving or creating Timeline tickets before the Timeline has been opened. Skip dependency delivery history reads when no completed dependency has a pull request to inspect, and avoid repeated attempt queries for unstarted Auto Build candidates.

Serialize first-use Timeline placement initialization across concurrent readers and writers, preserving batch order and allowing queued initialization to recover after a rejected write.

Keep first-page ticket reads coherent through successive synchronization revisions, including display-name enrichment, and stop restarting when the command is canceled.

Keep earlier unanswered Auto Build requests accessible after a later page empties, include ticket workers beyond the first page of live sessions, and reject gate reviews for archived tickets.
