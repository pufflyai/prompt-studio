import {
  commandRef,
  type DataTableRendererQueryParams,
  type DataTableRendererQueryResult,
  defineCommand,
  defineExtension,
  params,
} from "@pstdio/sdk/extensions";

const queryServicesCommand = commandRef<DataTableRendererQueryParams, DataTableRendererQueryResult>(
  "data-table-demo.services.query",
);
const restartServicesCommand = commandRef("data-table-demo.services.restart");

const rows = [
  {
    id: "gateway",
    values: {
      service: "Gateway",
      status: "healthy",
      region: "eu-north",
      requests: 18420,
      latency: 42,
    },
  },
  {
    id: "worker",
    values: {
      service: "Worker",
      status: "degraded",
      region: "us-east",
      requests: 9360,
      latency: 187,
    },
  },
];

export default defineExtension({
  commands: {
    "services.query": defineCommand({
      title: "Query services",
      async run() {
        return { rows };
      },
    }),
    "services.restart": defineCommand({
      title: "Restart selected services",
      params: {
        rowIds: params.json({ label: "Selected row ids", required: true }),
      },
      async run(ctx) {
        const rowIds = ctx.params.rowIds as string[];
        await ctx.notify.toast({
          type: "success",
          title: "Services restarted",
          message: `Restarted ${rowIds.length} services: ${rowIds.join(", ")}`,
        });
        return { restartedRowIds: rowIds };
      },
    }),
  },

  dataTableRenderers: {
    services: {
      title: "Service fleet",
      queryCommand: queryServicesCommand,
      selectionMode: "multiple",
      selectionActions: [
        {
          id: "restart",
          label: "Restart selected",
          icon: "RotateCcw",
          command: restartServicesCommand,
        },
      ],
      columns: [
        { id: "service", label: "Service", icon: "Server" },
        {
          id: "status",
          label: "Status",
          stat: { type: "top-values", limit: 3 },
          renderer: {
            type: "categorical-color",
            categories: [
              {
                value: "healthy",
                color: {
                  light: "#dcfce7",
                  dark: "#14532d",
                  foreground: { light: "#166534", dark: "#dcfce7" },
                },
              },
              {
                value: "degraded",
                color: {
                  light: "#ffedd5",
                  dark: "#7c2d12",
                  foreground: { light: "#9a3412", dark: "#ffedd5" },
                },
              },
            ],
          },
        },
        { id: "region", label: "Region", stat: { type: "unique" } },
        { id: "requests", label: "Requests", stat: { type: "histogram", bins: 4 } },
        { id: "latency", label: "Latency (ms)", stat: { type: "histogram", bins: 4 } },
      ],
      initialPageSize: 10,
      pageSizeOptions: [10, 20],
      emptyTitle: "No services",
      emptyDescription: "The demo query returned no services.",
    },
  },

  panels: {
    services: {
      title: "Service fleet",
      region: "main",
      closable: false,
      dataTableRenderer: "services",
    },
  },

  modes: {
    table: {
      id: "pstdio.data-table-demo.table",
      label: "DataTable Demo",
      icon: "Table2",
      layout: {
        panels: ["main"],
        open: [{ region: "main", panel: "services" }],
      },
    },
  },

  treeItems: {
    openTable: {
      target: "workbench.left.tree",
      group: "DataTable Demo",
      label: "DataTable Demo",
      icon: "table-2",
      action: {
        kind: "command",
        command: "workbench.action.switchMode",
        params: { modeId: "pstdio.data-table-demo.table" },
      },
    },
  },
});
