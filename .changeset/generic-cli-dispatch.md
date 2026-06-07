---
"pstdio": minor
---

Make the `pst` CLI dispatch domain-agnostic: the `tickets` namespace (and all its subcommands, including the draft workflow and `implement`) now resolves entirely through extension-contributed commands. Removes the built-in `tickets`/`statuses`/`tags` CLI groups and the dead legacy ticket api modules from core; only true-core commands stay static.
