export const dataTableRendererSource = `import type { WorkbenchModuleContribution } from "pstdio-workbench/core";

export const healthModule: WorkbenchModuleContribution = {
  id: "docs.health",
  activate(ctx) {
    ctx.renderers.registerDataTableRenderer({
      id: "docs.health.table",
      title: "Service health",
      columns: [
        { id: "service", label: "Service" },
        { id: "status", label: "Status", stat: { type: "top-values" } },
        { id: "details", label: "Details", renderer: { type: "json" } },
      ],
      executeQuery: () => ({
        rows: [
          { id: "api", values: { service: "API", status: "healthy", details: { region: "eu" } } },
        ],
      }),
      onRowClick: (row) => console.log(row.id),
    });
    ctx.layout.registerWidget({
      id: "docs.health.view",
      title: "Service health",
      area: "main",
      rendererId: "docs.health.table",
    });
    ctx.layout.openWidget("docs.health.view");
  },
};`;
