import { expect, test } from "bun:test";
import { createWorkbench, type WorkbenchLayout } from "@pstdio/workbench";
import { createWorkbenchTerminalModule, openWorkbenchTerminal } from "@pstdio/workbench/react";
import { migrateLegacyTerminalLayout } from "./legacy-terminal-layout";

const page = { kind: "page" as const, extensionId: "test", id: "home" };
const panel = { kind: "placement" as const, extensionId: "pstdio.pstdio-terminal", id: "terminal" };
const viewId = "pstdio.pstdio-terminal.view.terminal";
const registerPage = (w: ReturnType<typeof createWorkbench>) => {
  w.modes.registerMode({ id: "project", activate() {} });
  w.views.registerView({ id: "home", title: "Home", body: { kind: "react", render: () => null } });
  w.pages.registerPage({
    id: "test.home",
    ref: page,
    path: "home",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "home" }, cardinality: "one" },
    slots: [],
  });
  w.pageLocations.setProject("project");
  w.pageLocations.navigate({ kind: "page", page });
};

test("saved host terminal tabs restore through the installed placement in their chosen region", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const persistence = {
    getLayout: (scope?: string) => saved.get(scope),
    setLayout: (layout: WorkbenchLayout, scope?: string) => {
      saved.set(scope, structuredClone(layout));
    },
  };
  const first = createWorkbench({ layoutPersistence: persistence });
  first.registerModule(createWorkbenchTerminalModule());
  registerPage(first);
  const instance = openWorkbenchTerminal(first, {
    resource: {
      type: "workspace",
      id: "workspace",
      projectId: "project",
      metadata: { workspaceId: "workspace", workspacePath: "/owned" },
    },
  });
  first.movePanel(instance.instanceId, "side");
  await first.dispose();
  for (const [scope, layout] of saved) saved.set(scope, migrateLegacyTerminalLayout(layout));
  const restored = createWorkbench({ layoutPersistence: persistence });
  try {
    registerPage(restored);
    restored.views.registerView({ id: viewId, title: "Terminal", body: { kind: "react", render: () => null } });
    restored.modePlacements.registerPlacement({
      id: "pstdio.pstdio-terminal.placement.terminal",
      ref: panel,
      modeId: "project",
      region: "secondary",
      mountStrategy: "keep-mounted",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "terminal", extensionId: "pstdio.pstdio-terminal" }],
          view: { kind: "view", id: "terminal", extensionId: "pstdio.pstdio-terminal" },
          cardinality: "many",
        },
      },
    });
    expect(restored.layout.listPanelInstances("side")).toContainEqual(
      expect.objectContaining({
        viewId,
        title: "Terminal 1",
        resource: expect.objectContaining({
          extensionId: "pstdio.pstdio-terminal",
          metadata: { workspaceId: "workspace", workspacePath: "/owned" },
        }),
      }),
    );
  } finally {
    await restored.dispose();
  }
});
