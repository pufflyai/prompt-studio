import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

test("closing the last resource returns to its declared home page", () => {
  const workbench = createWorkbench();
  const home = { extensionId: "test", kind: "page", id: "sessions" } as const;
  const page = { ...home, id: "session" };
  workbench.modes.registerMode({ id: "sessions", label: "Sessions", activate: () => undefined });
  workbench.views.registerView({ id: "session", title: "Session", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: "sessions",
    ref: home,
    path: "sessions",
    modeId: "sessions",
    slots: [{ id: "content", role: "primary", region: "main", viewId: "session" }],
  });
  workbench.pages.registerPage({
    id: "session",
    parentId: "sessions",
    ref: page,
    path: "session",
    modeId: "sessions",
    slots: [
      {
        id: "content",
        role: "primary",
        region: "main",

        binding: { resourceKinds: ["session"], viewId: "session", cardinality: "one" },
      },
    ],
  });
  workbench.pageLocations.setProject("project");
  expect(workbench.pageLocations.navigate({ kind: "page", page, resource: { type: "session", id: "one" } }).ok).toBe(
    true,
  );
  const identity = workbench.layout.getLayout().regions.main.widgets[0]!.placementIdentity!;
  expect(workbench.pageLocations.closePlacement(identity).ok).toBe(true);
  expect(workbench.pages.store.getState().location).toEqual({ page: home });
  expect(workbench.layout.getLayout().regions.main.widgets).toMatchObject([{ closable: false }]);
});
