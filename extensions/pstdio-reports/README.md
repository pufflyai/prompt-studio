# Reports compatibility

New implementation and independent review outcomes live in core Resource Activity on the resource being worked on. Use the shipped `use-resource-activity` skill and `pst resources activity` commands. Sessions remain conversation resources without Activity.

This extension preserves historical report bodies, evidence files, RP identities and aliases. For Planner history, run:

```sh
pst pstdio-planner migrate-ticket-outcomes --id PS-12
```

Migration copies and verifies each body and attachment, preserves original authorship, timestamps and exact revision associations, and replaces the report's body with a link to the canonical Activity entry. It can resume after interruption. Reports with no unambiguous target remain readable here. New Planner submissions and reviews work without this extension installed.

`pst reports read --id <stable-id-or-RP-number>` continues resolving historical reports, including migrated evidence. A shared alias can return several matches; use a stable report ID to select one. Migrated file metadata includes `activityAttachmentId` and the owning resource reference.

Existing `reports write`, `save`, and `delete` commands remain compatibility APIs through their deprecation period. Do not use them to create a second copy of a new Activity outcome. Migrated reports cannot be edited; publish a new Activity entry for later work.
