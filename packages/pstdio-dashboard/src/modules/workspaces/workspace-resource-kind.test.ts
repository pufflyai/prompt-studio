import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import { createWorkspacesModule } from "./module";

describe("workspace resource kind", () => {
  test("opens from the command palette by replacing the active project view", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createWorkspacesModule());

    expect(workbench.resources.getKind("workspace")?.paletteOpenInput).toEqual({ replaceActive: true });
  });
});
