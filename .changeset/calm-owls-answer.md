---
"pstdio-planner": minor
---

Answer Planner review requests with `review --request-id`: tasks and decisions share one request list across tickets, the timeline, chat, and the CLI, and Review Needed stays on until every open request is settled. This replaces `resolve-human-request` and fixes handoffs that failed when they started a new chat.
