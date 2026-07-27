import type { WorkbenchModuleContribution } from "../../core";
import { WorkbenchIcon } from "../../react";

const rendererId = "data-table-renderer.story.health";

const themeColor = (light: string, dark: string) => ({ light, dark });

const rows = Array.from({ length: 24 }, (_, index) => {
  const score = 35 + ((index * 17) % 66);
  const status = score >= 80 ? "healthy" : score >= 55 ? "degraded" : "critical";
  return {
    id: `service-${index + 1}`,
    values: {
      service: `Service ${index + 1}`,
      status,
      score,
      latency: 40 + ((index * 37) % 460),
      details: { region: index % 2 === 0 ? "eu-north" : "us-east", replicas: 2 + (index % 4) },
    },
  };
});

export const createDataTableRendererStoryModule = (): WorkbenchModuleContribution => ({
  id: "data-table-renderer.story",
  activate(ctx) {
    ctx.renderers.registerDataTableRenderer({
      id: rendererId,
      title: "Service health",
      initialPageSize: 10,
      pageSizeOptions: [5, 10, 20],
      columns: [
        { id: "service", label: "Service", icon: <WorkbenchIcon name="Server" size={14} /> },
        {
          id: "status",
          label: "Status",
          stat: { type: "top-values", limit: 3 },
          renderer: {
            type: "categorical-color",
            categories: [
              { value: "healthy", color: themeColor("green.100", "green.900") },
              { value: "degraded", color: themeColor("orange.100", "orange.900") },
              { value: "critical", color: themeColor("red.100", "red.900") },
            ],
          },
        },
        {
          id: "score",
          label: "Health",
          description: "Composite service health score",
          stat: { type: "histogram", bins: 8 },
          renderer: {
            type: "color-scale",
            stops: [
              { value: 0, color: themeColor("red.300", "red.700") },
              { value: 60, color: themeColor("orange.300", "orange.700") },
              { value: 100, color: themeColor("green.300", "green.700") },
            ],
          },
        },
        { id: "latency", label: "Latency (ms)", stat: { type: "unique" } },
        { id: "details", label: "Details", renderer: { type: "json" } },
      ],
      executeQuery: () => ({ rows }),
      onRowClick: (row) => ctx.notifications.show({ title: `Opened ${row.values.service}`, level: "info" }),
      rowActions: [
        {
          id: "inspect",
          label: "Inspect service",
          icon: <WorkbenchIcon name="Search" size={16} />,
          run: (row) => {
            ctx.notifications.show({ title: `Inspecting ${row.values.service}`, level: "info" });
          },
        },
      ],
    });
    ctx.layout.registerPanel({
      closable: false,
      id: rendererId,
      title: "Service health",
      region: "main",
      rendererId,
      singleton: true,
    });
    ctx.layout.openPanel(rendererId);
  },
});
