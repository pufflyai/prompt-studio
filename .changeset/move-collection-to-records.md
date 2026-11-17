---
"pstdio": minor
"@pstdio/sdk": minor
---
Let extensions move a deprecated storage collection to records in one migration step with `migration.moveCollection`. Text history and editor bindings move with each item, old-format writes reach the moved records, and record indexes can select records by `keyPrefix`.
