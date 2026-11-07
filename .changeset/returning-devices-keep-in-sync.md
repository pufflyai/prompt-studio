---
"pstdio": minor
"@pstdio/sdk": minor
"@pstdio/workbench": minor
---

Signing out of Cloud now ends sync on the device, and a device that returns after signing out or going offline never overrides changes made on devices that stayed in sync. Unsent saves stay bounded, large returns wait for review, and `account.projectSyncStatus` reports changes held or replaced, with `account.resolveReturnedChanges` to apply, discard or dismiss them. Devices on earlier releases cannot read saves from this release, so update every device of an account together.
