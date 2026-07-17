import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../../core";
import { assistantWidgetId } from "../data";
import { createAssistantModule } from "./assistant-module";

describe("createAssistantModule", () => {
  test("opens the assistant in the docked side panel when enabled", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createAssistantModule());

    expect(workbench.layout.getAreaPresentation("side")).toBe("docked");
    expect(workbench.layout.getLayout().nodes.side?.collapsed).toBe(false);
    expect(workbench.layout.getLayout().areas.side?.widgets).toMatchObject([
      {
        contributionId: assistantWidgetId,
      },
    ]);
  });
});
