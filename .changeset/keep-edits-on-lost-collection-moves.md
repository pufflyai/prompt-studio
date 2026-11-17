---
"pstdio": patch
"@pstdio/sdk": patch
---
Keep edits a device makes to items it moved itself when another device's move of the same collection wins. The edit is saved again on the item, so the winning move carries it. The in-memory test storage now forwards partly skipped saves as well.
