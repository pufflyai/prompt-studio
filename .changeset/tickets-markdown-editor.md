---
"@pstdio/sdk": minor
"pstdio": minor
"pstdio-core-tickets": minor
---

Add a ticket markdown editor. A new `ViewContribution.resourceKind` lets a view declare itself the editor for a resource kind; the dashboard opens that view's webview (bound to the resource) when such a resource is opened. The tickets extension contributes a markdown editor webview with save-on-edit autosave (debounced, flushed on teardown), opened from a ticket board row.
