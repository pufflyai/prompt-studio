import { describe, expect, it } from "bun:test";
import { createWorkbenchCore, type WorkbenchModuleContribution } from "./workbench-core";

describe("workbench modules", () => {
  it("registers workbench modules through the workbench core API", () => {
    const workbench = createWorkbenchCore();
    const module: WorkbenchModuleContribution = {
      id: "dashboard.project",
      activate: (ctx) => {
        ctx.commands.registerCommand({ id: "project.open", label: "Open project" }, { execute: () => undefined });
      },
    };

    workbench.registerModule(module);

    expect(workbench.commands.getCommand("project.open")?.ownerId).toBe("dashboard.project");
    expect(workbench.commands.getCommand("project.open")?.source).toBe("module");
  });
});
