import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorkbench } from "../../core";
import { WorkbenchBreadcrumbView } from "../breadcrumb/breadcrumb-view";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchPageMenuHeader } from "./page-menu-header";

test("shows the title of a tabless page in its breadcrumb once", () => {
  const page = { kind: "page", id: "conversation", extensionId: "test" } as const;
  const view = { kind: "view", id: "conversation" } as const;
  const workbench = createWorkbench({ startPage: page });
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.views.registerView({ id: view.id, title: "Conversation", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: page.id,
    ref: page,
    title: "Conversation",
    path: "conversation",
    modeId: "project",
    slots: [],
    main: {
      kind: "view",
      view,
      cardinality: "one",
      presentation: "page",
      tab: { getSnapshot: () => ({ label: "Review the release" }) },
    },
  });
  workbench.pageLocations.switchProject("page-menu-header-test");
  workbench.pageLocations.navigate({ kind: "page", page });
  for (const store of [workbench.pages.store, workbench.breadcrumbs.store]) {
    store.getInitialState = store.getState;
  }

  const markup = renderToStaticMarkup(
    <WorkbenchThemeProvider>
      <WorkbenchBreadcrumbView workbench={workbench} />
      <WorkbenchPageMenuHeader workbench={workbench} />
    </WorkbenchThemeProvider>,
  );

  expect(markup.match(/>Review the release</g) ?? []).toHaveLength(1);
});
