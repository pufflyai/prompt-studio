# Extension API shape alignment acceptance

PRD 0012 (`documentation/requirements/platform/0012-align-extension-api-shapes.md` in the repository) follows the shared release gates in
PRD 0011 (`documentation/requirements/platform/0011-simplify-extension-apis.md` in the repository).
0.44 adds the replacement APIs and deprecations before its Version Packages PR merges.
0.45 adopts the published 0.44 SDK, converts data and removes the deprecated APIs.
An API that misses stable 0.44 moves to the next breaking release.

- One factory builds the capabilities for the dashboard, workbench and testbench hosts, and a test
  calls each capability through all three.
- Extensions in `extensions/` and `.pstdio/extensions/` make no raw `host.call` for a capability
  that has a typed client method.
- After 0.45, the API report has no `@deprecated` marker from this PRD, and a grep for each removed
  name in `extensions/`, `.pstdio/extensions/` and `packages/*/src` returns no callers.
- In 0.44, a test loads an extension that uses the deprecated slot placement, form and event names
  and gets the same behavior as with the new names.
