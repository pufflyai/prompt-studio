---
"@pstdio/sdk": minor
"pstdio": minor
"pstdio-core-tickets": minor
---

Make the tickets board fully usable: create tickets from a status column's "+" (opens the new ticket in the editor with an editable title), move tickets between status columns by drag, and archive/delete from a row context menu. Adds a `DataRendererContribution.rowActions` contribution wired through the dashboard's data-renderer bridge (`onCreateRow`, `onAttributeChange`, `getRowContextMenuActions`).
