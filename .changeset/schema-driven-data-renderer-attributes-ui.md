---
"@pstdio/ui": minor
---

Replace ticket-shaped `DataRendererRow`/`DataRendererContribution` schema with a declarative attribute system: rows become `{ id, title, resource?, attributes }` and contributions declare `attributes: AttributeDescriptor[]` (kinds: `enum`, `enum-multi`, `string`, `date`, `number`, `user`). Filter / group / sort / display menus, comparators, and inline editing dispatch on `AttributeType.kind`; the workbench no longer knows about resource-specific field names. Tag definitions, ordering/grouping/display unions, `DataRendererCardBadge`, `TagBadge`, and `onTagChange` are removed; persisted store state is auto-migrated from v1 (`ordering.field`, `tag:*` keys) to v2 attribute ids.
