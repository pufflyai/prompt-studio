# Report

## Confidence Score

0/5

## Summary

<!-- Replace this with the report summary. -->

## Validation Evidence

- Build: not run
- Unit tests: not run
- Playwright: not run
- Manual verification: not run

## Change Requests

<!-- Use one subsection per requested change. Keep resolved items in place and mark their status. -->

### P2 Example Change Request Title

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

The implementation has a concrete issue that should be addressed before relying on this result. The suggested change above guards against the empty-input case observed during validation.

## Artifacts

<!-- Drop supporting files under .pstdio/reports/<name>/files/ and link them here. `pst reports save` picks them up. -->

## Follow-up

<!-- Add remaining follow-up work or state "None". -->
