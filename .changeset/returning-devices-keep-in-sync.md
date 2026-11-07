---
"pstdio": minor
"@pstdio/sdk": minor
"@pstdio/workbench": minor
---

Signing out of Cloud now ends sync on the device, and a device that returns after signing out or going offline never overrides changes made on devices that stayed in sync. Unsent saves stay bounded, large returns wait for review, and `account.projectSyncStatus` reports changes held or replaced, with `account.resolveReturnedChanges` to apply, discard or dismiss them. `pst projects returned-changes <project> [apply|discard|dismiss]` lists and resolves them from the command line. Breaking: devices on earlier releases cannot read saves from this release. Such a device stops receiving a project's changes at the first new save, retrying it on every sync, until it updates. Update every device of an account together.
