export const dataTableRendererSource = `import type { WorkbenchModuleContribution } from "@pstdio/workbench";

export const healthModule: WorkbenchModuleContribution = {
  id: "docs.health",
  activate(ctx) {
    ctx.renderers.registerDataTableRenderer({
      id: "docs.health.table",
      title: "Service health",
      selectionMode: "multiple",
      selectionActions: [
        {
          id: "restart",
          label: "Restart selected",
          run: (rows) => console.log("Restart services", rows.map((row) => row.id)),
        },
      ],
      columns: [
        { id: "service", label: "Service" },
        { id: "status", label: "Status", stat: { type: "top-values" } },
        { id: "details", label: "Details", renderer: { type: "json" } },
      ],
      executeQuery: () => ({
        rows: [
          { id: "api", values: { service: "API", status: "healthy", details: { region: "eu" } } },
          { id: "worker", values: { service: "Worker", status: "degraded", details: { region: "us" } } },
          { id: "queue", values: { service: "Queue", status: "healthy", details: { region: "eu" } } },
        ],
      }),
      onRowClick: (row) => console.log(row.id),
    });
    ctx.layout.registerPanel({
      id: "docs.health.view",
      title: "Service health",
      region: "main",
      rendererId: "docs.health.table",
    });
    ctx.layout.openPanel("docs.health.view");
  },
};`;
