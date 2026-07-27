import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../../core";
import { assistantWidgetId } from "../data";
import { createAssistantModule } from "./assistant-module";

describe("createAssistantModule", () => {
  test("opens the assistant in the attached Side Panel when enabled", () => {
    const workbench = createWorkbenchCore();
    workbench.sidePanel.setMode("closed");

    workbench.registerModule(createAssistantModule());

    expect(workbench.sidePanel.getMode()).toBe("attached");
    expect(workbench.layout.listPanelInstances("side")).toMatchObject([{ panelId: assistantWidgetId }]);
  });
});
