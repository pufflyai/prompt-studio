import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import { getSidebarContributionFooterNodes } from "@/shared/workbench/contributions/sidebar-tree-contributions";
import { createHelpModule } from "./module";

describe("createHelpModule", () => {
  test("keeps Help in the sessions sidebar footer", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createHelpModule());

    expect(getSidebarContributionFooterNodes(workbench, "sessions").map((node) => node.label)).toContain("Help");
  });
});
