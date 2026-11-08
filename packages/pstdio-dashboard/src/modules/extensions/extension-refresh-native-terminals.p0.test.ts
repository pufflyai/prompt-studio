import { expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbench } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks, metadata } from "./module-test-fixtures";

test("an installed terminal survives a contribution refresh that temporarily unregisters its page", async () => {
  const w = createWorkbench();
  w.modes.registerMode({ id: "project", panels: ["main", "side", "secondary"], activate() {} });
  const viewId = metadata.views[0].id;
  let current: WorkbenchExtensionMetadata = {
    ...metadata,
    views: [{ ...metadata.views[0], body: { kind: "terminal", sessionHandlerId: `${viewId}.terminal.session` } }],
  };
  selectDashboardProject(w, { id: "native-refresh", name: "Native refresh" });
  const extension = w.registerModule(
    createExtensionsModule({ loadMetadata: async () => current, loadAppearance: async () => emptyAppearance }),
  );
  const writer = getWriter("extension_instances");
  let kills = 0;
  let opens = 0;
  try {
    await flushMicrotasks();
    await flushMicrotasks();
    w.pageLocations.setProject("native-refresh");
    expect(
      w.pageLocations.navigate({
        kind: "page",
        page: { extensionId: "pstdio.extension-lab", kind: "page", id: "labPage" },
      }).ok,
    ).toBe(true);
    const nativeBinding = () => {
      const panel = w.layout.listPanelInstances("main").find((panel) => panel.viewId === viewId)!;
      const body = w.views.getView(viewId)!.body;
      if (body.kind !== "terminal") throw new Error("Expected a native terminal view");
      const rendered = body.render({ workbench: w, instance: panel } as never) as {
        props: { nativeView: { ownerId: string } };
      };
      return { bindingId: panel.instanceId, ownerId: rendered.props.nativeView.ownerId };
    };
    w.terminal.setSessionOpener(async () => {
      opens += 1;
      return {
        id: "native-refresh-session",
        write() {},
        resize() {},
        kill() {
          kills += 1;
        },
        onData: () => () => {},
        onExit: () => () => {},
        onError: () => () => {},
      };
    });
    const open = () =>
      w.terminal.open({
        ...nativeBinding(),
        request: { cols: 80, rows: 24 },
      });
    await open();
    current = {
      ...current,
      commands: [...current.commands, { id: "other.command.new", extensionId: "other", title: "Other" }],
    };
    writer?.upsert({ id: "native-refresh-update" });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(w.commands.getCommand("other.command.new")).toBeDefined();
    expect(w.views.getView(viewId)).toBeDefined();
    expect(kills).toBe(0);
    await open();
    expect(opens).toBe(1);
  } finally {
    extension.dispose();
    writer?.remove("native-refresh-update");
    await w.dispose();
  }
});
