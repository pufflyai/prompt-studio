---
"@pstdio/sdk": minor
"pstdio": minor
"pstdio-core-tickets": minor
---

Add a create-ticket modal. A new `ViewContribution.surface: "modal"` lets a view mount as an overlay dialog; when a data renderer has a modal view matching its `resourceKind`, the board's column "+" opens that modal (pointed at the target column) instead of inline-creating, and the host closes it and refreshes the board once the create command succeeds. The tickets extension contributes a create-ticket modal webview with a markdown body editor plus status and tag selectors.
