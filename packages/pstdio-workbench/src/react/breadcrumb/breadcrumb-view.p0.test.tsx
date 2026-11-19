import { describe, expect, test } from "bun:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { buildWorkbenchBreadcrumbItems, WorkbenchBreadcrumbView } from "./breadcrumb-view";

describe("buildWorkbenchBreadcrumbItems", () => {
  test("does not add context actions for resource breadcrumbs", () => {
    const resource = {
      type: "dashboard-view",
      label: "Tickets",
      id: "pstdio://dashboard/tickets",
    };
    const items = [{ title: "Tickets", icon: "Table", resource }];
    const [item] = buildWorkbenchBreadcrumbItems(items);
    expect("contextMenuActions" in (item ?? {})).toBe(false);
  });
  test("keeps plain breadcrumbs action-free", () => {
    const items = [{ title: "Plain" }];
    const [item] = buildWorkbenchBreadcrumbItems(items);
    expect("contextMenuActions" in (item ?? {})).toBe(false);
  });
});

test("shows the resource owner's changing icon in the page breadcrumb", async () => {
  const workbench = createWorkbench();
  const page = { kind: "page" as const, extensionId: "test", id: "conversation" };
  const resource = {
    type: "publication",
    id: "draft-1",
    label: "Release notes",
    icon: "file-pen",
    iconColor: "fg.info",
    iconLabel: "Draft publication",
  };
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.views.registerView({ id: page.id, title: "Conversation", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: "sessions",
    ref: { ...page, id: "sessions" },
    title: "Sessions",
    path: "sessions",
    modeId: "project",
    main: { kind: "group", default: page },
    slots: [],
  });
  workbench.pages.registerPage({
    id: page.id,
    ref: page,
    title: "Conversation",
    path: "conversation",
    modeId: "project",
    parentId: "sessions",
    resource: { kinds: [{ kind: "resource-kind", id: "publication" }] },
    main: {
      kind: "view",
      presentation: "page",
      cardinality: "one",
      view: { kind: "view", id: page.id },
    },
    slots: [],
  });
  workbench.pageLocations.setProject("project");
  workbench.pageLocations.navigate({ kind: "page", page, resource });

  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  let renderer: ReactTestRenderer | undefined;
  const statusLabel = () => renderer!.root.findAllByType("svg").map((icon) => icon.props["aria-label"]);
  try {
    await act(async () => {
      renderer = create(
        <WorkbenchThemeProvider>
          <WorkbenchBreadcrumbView workbench={workbench} />
        </WorkbenchThemeProvider>,
      );
    });
    expect(statusLabel()).toEqual(["Draft publication"]);

    await act(async () => {
      workbench.pages.refreshResource({
        ...resource,
        icon: "book-open",
        iconColor: "fg.success",
        iconLabel: "Published",
      });
    });
    expect(statusLabel()).toEqual(["Published"]);
  } finally {
    await act(async () => renderer?.unmount());
    await workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
