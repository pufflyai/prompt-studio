import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { createHelpModule } from "./module";

describe("createHelpModule", () => {
  test("registers Help once on the shared project sidenav footer", async () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createHelpModule());

    const projectNodes = (
      await workbench.navigationTrees.getSections({ kind: "mode", id: "project", extensionId: "pstdio" }, "footer")
    ).flatMap((section) => section.nodes);
    const sessionNodes = (
      await workbench.navigationTrees.getSections({ kind: "mode", id: "sessions", extensionId: "pstdio" }, "footer")
    ).flatMap((section) => section.nodes);

    expect(projectNodes.map((node) => node.label)).toContain("Help");
    expect(sessionNodes).toEqual([]);
  });
});
