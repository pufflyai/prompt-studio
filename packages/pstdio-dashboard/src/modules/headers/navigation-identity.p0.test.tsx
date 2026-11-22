import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { WorkbenchThemeProvider } from "@pstdio/workbench/react";
import type { ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createHeadersModule } from "./module";

test("desktop navigation shows resource breadcrumbs only for dedicated pages", async () => {
  const w = createWorkbench();
  const ref = (id: string) => ({ kind: "page" as const, extensionId: "test.headers", id });
  w.modes.registerMode({ id: "project", activate() {} });
  w.views.registerView({ id: "detail", title: "Detail", body: { kind: "react", render: () => null } });
  w.pages.registerPage({
    id: "home",
    ref: ref("home"),
    title: "Home",
    path: "home",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
  w.pages.registerPage({
    id: "detail",
    ref: ref("detail"),
    title: "Detail",
    path: "detail",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "detail" }, cardinality: "one", presentation: "page" },
    slots: [],
  });
  w.registerModule(createHeadersModule({ select() {}, clear() {} }));
  w.pageLocations.setProject("project");
  w.pageLocations.navigate({ kind: "page", page: ref("home") });
  const view = w.views.getView(dashboardWidgetIds.projectHeader)!;
  if (view.body.kind !== "react") throw new Error("Missing navigation header");
  const renderHeader = view.body.render;
  const instance = w.layout.listPanelInstances("nav")[0]!;
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  let renderer: ReactTestRenderer | undefined;
  const breadcrumbs = () =>
    renderer!.root.findAll((node) => node.type === "nav" && node.props["aria-label"] === "breadcrumb");
  try {
    await act(async () => {
      renderer = create(
        <WorkbenchThemeProvider>
          {
            renderHeader({
              workbench: w,
              panel: w.layout.getPanel(instance.panelId)!,
              instance,
              refresh() {},
            }) as ReactNode
          }
        </WorkbenchThemeProvider>,
      );
    });
    expect(breadcrumbs()).toHaveLength(0);
    await act(async () => {
      w.pageLocations.navigate({ kind: "page", page: ref("detail") });
    });
    expect(breadcrumbs()).toHaveLength(1);
    await act(async () => {
      w.pageLocations.navigate({ kind: "page", page: ref("home") });
    });
    expect(breadcrumbs()).toHaveLength(0);
  } finally {
    await act(async () => renderer?.unmount());
    await w.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
