import { expect, test } from "bun:test";
import { resolvePagePlacements } from "./page-placement-resolver";
import type { WorkbenchPageContribution } from "./page-registry-types";

test("resolves page panels from the current resource capabilities", () => {
  const page: WorkbenchPageContribution = {
    id: "workspace",
    ref: { kind: "page", extensionId: "pstdio", id: "workspace" },
    path: "workspace",
    modeId: "project",
    main: { kind: "panels", empty: { kind: "view", id: "empty" } },
    slots: [
      {
        id: "changes",
        region: "main",
        isAvailable: (resource) => resource?.metadata?.supportsDiff === true,
        item: { kind: "view", view: { kind: "view", id: "changes" }, presence: "fixed" },
      },
      { id: "files", region: "main", item: { kind: "view", view: { kind: "view", id: "files" }, presence: "fixed" } },
    ],
  };
  for (const supportsDiff of [true, false, true]) {
    const placements = resolvePagePlacements({
      page,
      state: { openStaticSlotIds: [], resourceInstances: {} },
      resource: { type: "workspace", id: "workspace", metadata: { supportsDiff } },
      sharedPlacements: [],
      resolvePagePlacement: (input) => input.viewId,
    });
    expect(placements.map((placement) => placement.value)).toEqual(supportsDiff ? ["changes", "files"] : ["files"]);
  }
});
