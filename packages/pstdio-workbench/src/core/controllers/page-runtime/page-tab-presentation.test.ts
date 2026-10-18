import { expect, test } from "bun:test";
import { createLocalStorageWorkbenchPersistence } from "../../../storage/local-storage-persistence";
import { createWorkbench } from "../../workbench-core";

for (const owner of ["shell", "mode", "host"] as const) {
  test(`a restored ${owner} Main tab uses its live presentation after JSON persistence`, () => {
    const persistence = createLocalStorageWorkbenchPersistence({ namespace: "tabs", debounceMs: 0 });
    const w = createWorkbench(persistence);
    w.views.registerView({ id: "document", title: "Document", body: { kind: "react", render: () => null } });
    w.modes.registerMode({ id: "project", activate() {} });
    const ref = (id: string) => ({ kind: "page" as const, extensionId: "test", id });
    for (const id of ["tickets", "planner"])
      w.pages.registerPage({
        id,
        ref: ref(id),
        path: id,
        modeId: "project",
        main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" },
        slots: [],
      });
    let label = "Before";
    const tab = { getSnapshot: () => ({ label }), subscribe: () => () => undefined };
    const item = {
      kind: "binding" as const,
      binding: {
        kinds: [{ kind: "resource-kind" as const, id: "document" }],
        view: { kind: "view" as const, id: "document" },
        cardinality: "many" as const,
      },
    };
    const resource = { type: "document", id: "session" };
    w.pageLocations.setProject("project");
    const navigate = (id: string) => w.pageLocations.navigate({ kind: "page", page: ref(id) });
    navigate("tickets");
    if (owner === "shell") {
      w.shellPlacements.registerPlacement({ id: "sessions", region: "side", item, tab });
      w.shellPlacements.openPlacement({ placementId: "sessions", resource, open: "pin" });
    } else if (owner === "mode") {
      const panel = { kind: "placement" as const, extensionId: "test", id: "sessions" };
      w.modePlacements.registerPlacement({ id: "sessions", ref: panel, modeId: "project", region: "side", item, tab });
      w.modePlacements.openPlacement({ panel, resource, open: "pin" });
    } else {
      w.layout.registerPanel({ id: "sessions", title: "Sessions", rendererId: "document", region: "side", tab });
      w.layout.openPanel("sessions", { resource, strategy: { kind: "persistent" } });
    }
    const panel = w.layout.getActivePanel("side")!;
    w.movePanel(panel.instanceId, "main");
    navigate("planner");
    label = "After";
    navigate("tickets");
    const restored = w.layout.listPanelInstances("main").find((p) => p.instanceId === panel.instanceId)!;
    expect(restored.tab!.getSnapshot(restored)).toEqual({ label: "After" });
    expect(restored.tab!.subscribe).toBeFunction();
    persistence.layoutPersistence.dispose?.();
  });
}
