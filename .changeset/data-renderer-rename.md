---
"@pstdio/ui": minor
---

Rename `TicketsWorkspace` → `DataRenderer` and align all related symbols/files with the data-renderer abstraction. Component renames: `TicketsWorkspace`/`TicketBoard`/`TicketList`/`TicketCard` → `DataRenderer`/`DataRendererBoard`/`DataRendererList`/`DataRendererCard`. Type renames: `WorkspaceTicket`/`WorkspaceSettings`/`WorkspaceTagDefinition`/`WorkspaceOption`/`WorkspaceFilterCategory`/`FilterState`/etc → `DataRendererRow`/`DataRendererSettings`/`DataRendererTagDefinition`/`DataRendererOption`/`DataRendererFilterCategory`/`DataRendererFilterState`/etc. Hook: `useTicketsWorkspaceStore` → `useDataRendererStore`. File paths moved from `components/tickets/` to `components/data-renderer/`. Field-concept names (`GroupingField`, `OrderingField`, `DisplayProperty`, `ViewMode`) and prop field names (`tickets`, `onTicketClick`, etc.) stay unchanged.
