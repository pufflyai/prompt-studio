export const kanbanRendererSource = `import type { WorkbenchModuleContribution } from "@pstdio/workbench";

const ROWS_WIDGET_ID = "docs.rows";

export const createRowsModule = (): WorkbenchModuleContribution => ({
  id: "docs.rows",
  activate(ctx) {
    ctx.renderers.registerKanbanRenderer({
      id: ROWS_WIDGET_ID,
      title: "Rows",
      attributes: [
        {
          id: "status",
          label: "Status",
          type: {
            kind: "enum",
            options: [
              { value: "backlog", label: "Backlog", color: "gray" },
              { value: "review", label: "Review", color: "purple" },
              { value: "done", label: "Done", color: "green" },
            ],
          },
          filterable: true,
          groupable: true,
          displayable: true,
        },
      ],
      executeQuery: () => [
        { id: "DR-1", title: "Schema-aware grouping", attributes: { status: "review" } },
      ],
    });
    ctx.layout.registerPanel({
      id: ROWS_WIDGET_ID,
      title: "Rows",
      region: "main",
      rendererId: ROWS_WIDGET_ID,
    });
    ctx.layout.openPanel(ROWS_WIDGET_ID);
  },
});`;
