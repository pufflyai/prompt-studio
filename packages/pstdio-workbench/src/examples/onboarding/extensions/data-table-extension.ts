import { defineExtension, definePage, defineView, workbenchModes } from "@pstdio/sdk/extensions";

const services = defineView({
  id: "services",
  title: "Services",
  body: {
    kind: "dataTable",
    selectionMode: "multiple",
    columns: [
      { id: "name", label: "Name" },
      {
        id: "status",
        label: "Status",
        renderer: {
          type: "categorical-color",
          categories: [
            { value: "healthy", color: { light: "green.100", dark: "green.900" } },
            { value: "degraded", color: { light: "orange.100", dark: "orange.900" } },
          ],
        },
      },
      { id: "latency", label: "Latency (ms)" },
    ],
    query: async () => ({
      rows: [
        { id: "api", values: { name: "API", status: "healthy", latency: 42 } },
        { id: "worker", values: { name: "Worker", status: "degraded", latency: 180 } },
        { id: "web", values: { name: "Web", status: "healthy", latency: 61 } },
      ],
    }),
  },
});
export const servicesPage = definePage({
  id: "services",
  title: "Services",
  path: "services",
  mode: workbenchModes.project,
  main: {
    kind: "view",
    view: services.ref,
    cardinality: "one",
  },
  slots: [],
});
export default defineExtension({
  views: [services],
  pages: [servicesPage],
});
