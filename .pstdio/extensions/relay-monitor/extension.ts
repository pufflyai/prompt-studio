import {
  defineConnection,
  defineExtension,
  defineNavigationItem,
  definePage,
  defineView,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { commands } from "./src/commands";
import { connectionId } from "./src/model";

const view = defineView({
  id: "monitor",
  title: "Relay monitoring",
  icon: "activity",
  body: {
    kind: "webview",
    entry: packageAsset("./src/main.tsx", import.meta.url),
    capabilities: ["commands.execute", "commands.query"],
  },
});
const page = definePage({
  id: "monitor",
  title: "Relay monitoring",
  icon: "activity",
  path: "relay-monitor",
  mode: workbenchModes.project,
  main: { kind: "view", view: view.ref, cardinality: "one", presentation: "page" },
  slots: [],
});
export default defineExtension({
  commands: Object.values(commands),
  views: [view],
  pages: [page],
  navigationItems: [
    defineNavigationItem({
      id: "monitor",
      owner: workbenchModes.project,
      label: "Relay monitoring",
      icon: "activity",
      action: { kind: "page", page: page.ref },
    }),
  ],
  connections: [
    defineConnection({
      id: connectionId,
      label: "Relay monitoring · production",
      transport: "http",
      auth: { type: "bearer" },
      allowedMethods: ["GET"],
      allowedPathPrefixes: [
        "/health",
        "/prometheus/api/v1/query",
        "/prometheus/api/v1/query_range",
        "/loki/api/v1/query_range",
        "/alerts/api/v2/alerts",
      ],
      check: { method: "GET", path: "/health" },
    }),
  ],
});
