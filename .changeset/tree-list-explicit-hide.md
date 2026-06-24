---
"@pstdio/ui": patch
---

TreeList customization is now explicit: sections and rows opt in to the hide/show menu via canHide (off by default), and the menu builder accepts header/body/footer regions. Categories, header/footer rows, and opted-in top-level body rows (e.g. a "Tickets" nav entry) are hideable; leaf sub-items never are. Adds filterVisibleNodes for flat header/footer lists.
