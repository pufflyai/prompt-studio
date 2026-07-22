import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import { getSidenavContributionFooterNodes } from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { createHelpModule } from "./module";

describe("createHelpModule", () => {
  test("keeps Help in the sessions sidenav footer", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createHelpModule());

    expect(getSidenavContributionFooterNodes(workbench, "sessions").map((node) => node.label)).toContain("Help");
  });
});
