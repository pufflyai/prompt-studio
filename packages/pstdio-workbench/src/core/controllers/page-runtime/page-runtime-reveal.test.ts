import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

test("selecting a resource reveals its page follower in a closed side panel", () => {
  const workbench = createWorkbench({ initialSidePanelMode: "closed" });
  const page = { extensionId: "test", kind: "page" as const, id: "issues" };
  workbench.modes.registerMode({ id: "issues", activate: () => undefined });
  workbench.views.registerView({ id: "board", title: "Board", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: "issues",
    ref: page,
    title: "Issues",
    path: "issues",
    modeId: "issues",
    slots: [
      {
        id: "main",
        role: "primary",
        region: "main",

        binding: { resourceKinds: ["issue"], viewId: "board", cardinality: "one" },
      },
      {
        id: "reader",
        role: "auxiliary",
        region: "side",
        binding: { resourceKinds: ["issue"], viewId: "board", cardinality: "one" },
        openOn: "page-resource",
      },
    ],
  });
  workbench.pageLocations.switchProject("test-project");
  workbench.pageLocations.navigate({ kind: "page", page, resource: { type: "issue", id: "1" } });
  expect(workbench.layout.getLayout().regions.side.widgets).toHaveLength(1);
  expect(workbench.sidePanel.getMode()).toBe("attached");
  workbench.sidePanel.setMode("closed");
  workbench.pageLocations.navigate({ kind: "page", page, resource: { type: "issue", id: "2" } });
  expect(workbench.sidePanel.getMode()).toBe("attached");
});
