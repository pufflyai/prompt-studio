---
"pstdio": minor
"@pstdio/sdk": patch
"pstdio-skills": patch
---

Add `pst extensions update` to bring managed extensions to the release matching the CLI, scope `pst extensions check` with a source path or `--scope repo|user`, print the CLI/extension API/SDK/dashboard version matrix in check output, make API-version errors name the side to update, and make `spawnDetached` processes survive host shutdown.
