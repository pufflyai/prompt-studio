import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

test("closing a hybrid resource returns to its default page without a parent cycle", () => {
  const workbench = createWorkbench();
  const page = { extensionId: "test", kind: "page", id: "sessions" } as const;
  workbench.modes.registerMode({ id: "sessions", label: "Sessions", activate: () => undefined });
  workbench.views.registerView({ id: "session", title: "Session", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: "sessions",
    ref: page,
    path: "sessions",
    modeId: "sessions",
    slots: [
      {
        id: "content",
        role: "primary",
        region: "main",
        viewId: "session",
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
  expect(workbench.pages.store.getState().location).toEqual({ page });
  expect(workbench.layout.getLayout().regions.main.widgets).toMatchObject([{ closable: false }]);
});
