import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "pstdio-workbench/core";
import { createSettingsModule } from "./module";

describe("createSettingsModule", () => {
  test("registers the project settings resource kind", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSettingsModule());

    expect(workbench.resources.getKind("project-settings")).toMatchObject({
      label: "Project settings",
      icon: "Settings",
    });
  });
});
