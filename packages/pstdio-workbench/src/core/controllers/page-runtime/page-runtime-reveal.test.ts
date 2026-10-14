import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";
import { registerResourcePage } from "./page-runtime-test-support";

for (const reveal of [undefined, "always", "explicit"] as const) {
  test(`page followers apply ${reveal ?? "legacy"} reveal policy`, () => {
    const workbench = createWorkbench({ initialSidePanelMode: "closed" });
    const page = { extensionId: "test", kind: "page" as const, id: "issues" };
    workbench.modes.registerMode({ id: "issues", activate: () => undefined });
    workbench.views.registerView({ id: "board", title: "Board", reveal, body: { kind: "react", render: () => null } });
    registerResourcePage(workbench, {
      id: "issues",
      ref: page,
      title: "Issues",
      path: "issues",
      modeId: "issues",
      resource: {
        kinds: [
          {
            kind: "resource-kind",
            id: "issue",
          },
        ],
      },
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "board",
        },
        cardinality: "one",
      },
      slots: [
        {
          id: "reader",
          region: "side",
          openOn: "page-resource",
          item: {
            kind: "binding",
            binding: {
              kinds: [
                {
                  kind: "resource-kind",
                  id: "issue",
                },
              ],
              view: {
                kind: "view",
                id: "board",
              },
              cardinality: "one",
            },
          },
        },
      ],
    });
    workbench.pageLocations.switchProject("test-project");
    if (reveal === "explicit") workbench.sidePanel.setMode("closed");
    workbench.pageLocations.navigate({ kind: "page", page, resource: { type: "issue", id: "1" } });
    expect(workbench.layout.getLayout().regions.side.widgets).toHaveLength(1);
    expect(workbench.sidePanel.getMode()).toBe(reveal === "explicit" ? "closed" : "floating");
    workbench.sidePanel.setMode("closed");
    workbench.pageLocations.navigate({ kind: "page", page, resource: { type: "issue", id: "2" } });
    expect(workbench.sidePanel.getMode()).toBe(reveal === "explicit" ? "closed" : "attached");
  });
}
