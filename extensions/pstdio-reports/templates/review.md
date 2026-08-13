<!-- Summarize the independent review and state whether the change request is ready to merge. -->

## Confidence Score

<!-- The lower the score, the more dangerous it is to merge the change request. -->

0/5

## Review Scope

<!-- Link the change request and list what was reviewed. State anything that was outside the review scope. -->

## Validation

<!-- Describe the checks performed and their results. Link supporting evidence and artifacts. -->

## Change Requests

<!-- Use one subsection per requested change. Keep resolved requests in place and update their status. State "None" when no changes are requested. -->

<!-- Priority levels:
- P0: A release blocker. The change risks severe security, data loss, or widespread failure and must not merge.
- P1: A major correctness or regression issue that must be fixed before merge.
- P2: An important but non-blocking issue that should be fixed, such as a meaningful edge case or test gap.
- P3: An optional improvement or suggestion that may be handled later.
-->

<!-- Example issue. Replace or remove it when writing the review. -->

### P1 Reject empty input before parsing

Status: unresolved

File: `path/to/file.ts:42`

```diff
@@ path/to/file.ts:40-46 @@
 export const handler = (input: string) => {
-  return parse(input);
+  if (!input) return null;
+  return parse(input);
 };
```

The implementation passes empty input into `parse`, which causes the reviewed flow to fail. Guard the empty-input case before parsing and add a test that proves the expected behavior.

## Relevant Resources

<!-- Link the change request, ticket, code, documentation, ADRs, designs, pull request, and other useful context. -->

## Artifacts

<!-- Drop supporting files under the filesPath returned by `pst reports write` and link them here. `pst reports save` picks them up. -->

## Follow-up

<!-- Add remaining follow-up work or state "None". -->

None.
