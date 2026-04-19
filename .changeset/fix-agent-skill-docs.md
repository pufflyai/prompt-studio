---
"pstdio": patch
---

Fix bundled agent skill docs: replace references to the non-existent `pstdio hooks` CLI with the real `pstdio plugins` command group, drop the fictional shell-hook runtime in favor of SDK plugin guidance, rename `write-pstdio-hook` → `create-pstdio-plugin` and extend it to cover both hooks and actions, and clean up the CLI reference (remove `projects startup-script`, `workspaces startup-log`, `docs init`, `workspaces delete --force`; add `agents install-plugins` and the full set of `tickets` subcommands).
