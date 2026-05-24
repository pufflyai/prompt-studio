import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "pstdio-workbench/core";
import { createWorkspacesModule } from "./module";

describe("createWorkspacesModule", () => {
  test("registers the workspace resource kind", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createWorkspacesModule());

    expect(workbench.resources.getKind("workspace")).toMatchObject({
      label: "Workspace",
      icon: "GitBranch",
    });
  });
});
