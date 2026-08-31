import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { createHelpModule } from "./module";

describe("createHelpModule", () => {
  test("keeps Help in the sessions sidenav footer", async () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createHelpModule());

    const nodes = (
      await workbench.navigationTrees.getSections({ kind: "mode", id: "sessions", extensionId: "pstdio" }, "footer")
    ).flatMap((section) => section.nodes);
    expect(nodes.map((node) => node.label)).toContain("Help");
  });
});
