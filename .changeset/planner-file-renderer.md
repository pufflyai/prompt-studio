---
"pstdio-planner": minor
---

Render ticket content with the native file renderer instead of a webview, fixing slow ticket load. The ticket stays a single navigable resource: the files tree selects the body, a ticket file, or an image attachment, and the editor swaps that document in place (Markdown, Monaco, or read-only image) while the tree and properties panel stay mounted.
