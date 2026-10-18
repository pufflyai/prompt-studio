# Extension storage acceptance

This is the acceptance appendix of PRD 0009 (`documentation/requirements/platform/0009-standardize-storage-api.md` in the repository).

## Completion checks

- 0.44: the new contracts pass; APIs deprecated in 0.44 still work; APIs deprecated in 0.43.1 are gone.
- The 0010 conversion gate passes before the 0.45 conversion merges.
- Local data converts without losing IDs, ordering, attachments or old URLs. Interrupted conversion
  resumes without duplicates. Commands during conversion get `storage_converting`.
- Package files are read-only. Traversal, foreign-owner access and a missing current workspace fail.
- Attachment uploads resume, verify bytes, stay out of `records.list()` and render in the browser.
- Artifact, ticket and report links and historical revisions open after conversion and restart.
- Affected extensions, testbench, CLI and browser consumers pass checks against the published SDK.
  API report, version checks, package boundaries and the packaged verifier pass. Validate affected
  UI with Playwright.
- 0.45: no maintained extension uses a deprecated API, every manifest accepts 0.3.0 and the old
  APIs are gone. The migration reader and old URL routes remain.

The isolated prototype verifies authoring examples and in-memory saves only.

