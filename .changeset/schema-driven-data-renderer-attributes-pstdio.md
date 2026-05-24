---
"pstdio": minor
---

Migrate `DataRendererContribution` and `WorkbenchDataView` to the schema-driven attribute system: contributions declare `attributes: AttributeDescriptor[]` instead of `tagDefinitions` / `filterCategories` / `groupingOptions` / `orderingOptions` / `displayPropertyOptions`, and a single `onAttributeChange(rowId, attributeId, value)` callback replaces `onTagChange` and `onMoveTicket`. Saved views silently drop references to attribute ids the active contribution no longer declares. The dashboard workspaces module and the in-tree example modules are migrated to the new contract.
