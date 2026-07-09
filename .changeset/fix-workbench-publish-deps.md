---
"@pstdio/workbench": patch
---

Declare `@pstdio/sdk` and `@pstdio/ui` with caret version ranges instead of `workspace:*`. `changeset publish` runs npm, which does not convert the bun workspace protocol, so `@pstdio/workbench@0.2.0` shipped unresolvable `workspace:*` dependencies and could not be installed outside the monorepo.
