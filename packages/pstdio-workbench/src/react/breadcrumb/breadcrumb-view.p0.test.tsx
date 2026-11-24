import { expect, test } from "bun:test";
import { EnvironmentProvider } from "@chakra-ui/react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchBreadcrumbView } from "./breadcrumb-view";

// The renderer has no DOM. Tooltip focus tracking resolves an environment root even here.
const environmentRoot = new EventTarget() as Document;

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
        <EnvironmentProvider value={environmentRoot}>
          <WorkbenchThemeProvider>
            <WorkbenchBreadcrumbView workbench={workbench} />
          </WorkbenchThemeProvider>
        </EnvironmentProvider>,
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

test("a page tab without a label shows its resource's title in the breadcrumb", async () => {
  const workbench = createWorkbench();
  const page = { kind: "page" as const, extensionId: "test", id: "note" };
  const resource = { type: "note", id: "note-1", label: "Recover before closing" };
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.views.registerView({ id: page.id, title: "Note", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: "notes",
    ref: { ...page, id: "notes" },
    title: "Notes",
    path: "notes",
    modeId: "project",
    main: { kind: "group", default: page },
    slots: [],
  });
  workbench.pages.registerPage({
    id: page.id,
    ref: page,
    title: "Note",
    path: "note",
    modeId: "project",
    parentId: "notes",
    resource: { kinds: [{ kind: "resource-kind", id: "note" }] },
    main: {
      kind: "view",
      presentation: "page",
      cardinality: "one",
      view: { kind: "view", id: page.id },
      // A removed note's tab answers without a label.
      tab: { getSnapshot: () => ({}) },
    },
    slots: [],
  });
  workbench.pageLocations.setProject("project");
  workbench.pageLocations.navigate({ kind: "page", page, resource });
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(
        <EnvironmentProvider value={environmentRoot}>
          <WorkbenchThemeProvider>
            <WorkbenchBreadcrumbView workbench={workbench} />
          </WorkbenchThemeProvider>
        </EnvironmentProvider>,
      );
    });
    expect(JSON.stringify(renderer!.toJSON())).toContain("Recover before closing");
  } finally {
    await act(async () => renderer?.unmount());
    await workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
