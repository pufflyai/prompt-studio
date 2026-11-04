import { defineExtension, definePage, defineView, workbenchModes } from "@pstdio/sdk/extensions";

const resources = defineView({
  id: "resources",
  title: "Resources",
  body: {
    kind: "resourceList",
    attributes: [
      {
        id: "device",
        label: "Device",
        groupable: true,
        filterable: true,
        type: {
          kind: "enum",
          options: [
            { value: "local", label: "This device", color: "green", note: "Online" },
            { value: "remote", label: "Build box", color: "gray", note: "Offline" },
          ],
        },
      },
    ],
    defaultSettings: { columnGrouping: "device", showChildren: true },
    query: async () => ({
      rows: [
        {
          id: "local",
          title: "Improve search",
          icon: "folder",
          attributes: { id: "WS-12", device: "local" },
          children: [{ id: "session", title: "Check search results", icon: "message-square", attributes: {} }],
        },
        { id: "remote", title: "Build release", icon: "folder", attributes: { device: "remote" } },
      ],
    }),
  },
});

export default defineExtension({
  views: [resources],
  pages: [
    definePage({
      id: "resources",
      title: "Resources",
      path: "resources",
      mode: workbenchModes.project,
      main: { kind: "view", view: resources.ref, cardinality: "one" },
      slots: [],
    }),
  ],
});
