import { createWorkbenchCore } from "pstdio-workbench/core";
import { describeResourceRouteContract, type RouteContractHarness } from "pstdio-workbench/testing";
import { selectDashboardProject } from "@/shared/app/project-context";
import { registerResourceRoute } from "./route-helper";

const ROOT = {
  kind: "dashboard-view",
  uri: "dashboard-workbench://route-test",
  id: "route-test",
  label: "Route test",
};
const DETAIL_KIND = "route-test-detail";
const MODE = "route-test-mode";

// Builds a real workbench whose only route is produced by registerResourceRoute, then runs the
// shared navigation contract against it. This proves the helper emits a contract-compliant route.
const setup = (): RouteContractHarness => {
  const workbench = createWorkbenchCore();
  selectDashboardProject(workbench, { id: "project-1", name: "Route test" });
  workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
  workbench.resources.registerKind({ kind: DETAIL_KIND, label: "Detail" });

  workbench.registerModule({
    id: "route-test.module",
    activate(ctx) {
      ctx.modes.registerMode({ id: MODE, label: "Route test", activate: () => undefined });
      ctx.layout.registerWidget({
        id: "route-test-root",
        title: "Root",
        area: "main",
        singleton: true,
        rendererId: "noop",
        resourceKinds: ["dashboard-view"],
      });
      ctx.layout.registerWidget({
        id: "route-test-detail",
        title: "Detail",
        area: "main",
        singleton: true,
        rendererId: "noop",
        resourceKinds: [DETAIL_KIND],
      });
      registerResourceRoute(ctx, {
        id: "route-test.root",
        match: (resource) => resource.uri === ROOT.uri,
        mode: MODE,
        widgetId: "route-test-root",
      });
      registerResourceRoute(ctx, {
        id: "route-test.detail",
        match: (resource) => resource.kind === DETAIL_KIND,
        mode: MODE,
        widgetId: "route-test-detail",
      });
      return undefined;
    },
  });

  return { workbench };
};

describeResourceRouteContract({
  name: "route-helper",
  setup,
  root: ROOT,
  detail: { kind: DETAIL_KIND, uri: "route-test://detail/1", id: "1", label: "Detail 1" },
  detailB: { kind: DETAIL_KIND, uri: "route-test://detail/2", id: "2", label: "Detail 2" },
  expectedMode: MODE,
});
