import type { WorkbenchModuleContribution } from "../../core";

export const createPagedTableStoryModule = (discovered: boolean) =>
  ({
    id: "paged-table.story",
    activate(ctx) {
      const id = "paged-table.story.table";
      const columns = [
        { id: "title", label: "Title", type: "string" as const },
        { id: "status", label: "Status", type: "string" as const, groupable: true },
      ];
      const rows = [
        { id: "one", values: { title: "First task", status: "todo" } },
        { id: "two", values: { title: "Second task", status: "done" } },
      ];
      ctx.views.registerView({
        id,
        title: "Paged tasks",
        body: {
          kind: "dataTable",
          queryMode: "paged",
          columns: discovered ? undefined : columns,
          defaultSettings: { showStats: false, grouping: discovered ? "none" : "status" },
          executeQuery: ({ page }) => {
            const selected = rows.filter((row) => !page?.collapsedGroups?.includes(row.values.status));
            return {
              columns,
              rows: selected.map((row) => ({
                ...row,
                values: Object.fromEntries(Object.entries(row.values).filter(([key]) => page?.fields.includes(key))),
              })),
              page: {
                revision: "story-1",
                cursor: null,
                total: rows.length,
                filteredTotal: selected.length,
                groups: rows.map((row) => ({ field: "status", value: row.values.status, count: 1 })),
              },
            };
          },
        },
      });
      ctx.shellPlacements.registerPlacement({
        id,
        item: { kind: "view", presence: "fixed", view: { kind: "view", id } },
        region: "main",
      });
    },
  }) satisfies WorkbenchModuleContribution;
