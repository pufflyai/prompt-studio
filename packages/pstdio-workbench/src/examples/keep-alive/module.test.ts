import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { createKeepAliveExampleModule } from "./module";

describe("createKeepAliveExampleModule", () => {
  test("keeps one side placement while its presentation changes", async () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createKeepAliveExampleModule());

    const layout = workbench.layout.getLayout();
    expect(layout.areas.main?.widgets[0]?.resource).toMatchObject({
      kind: "workbench-example",
      uri: "pstdio://examples/keep-alive",
    });
    expect(layout.areas.side?.widgets).toHaveLength(1);
    expect(workbench.layout.getAreaPresentation("side")).toBe("docked");

    await workbench.commands.executeCommand("keep-alive.example.showBubble");
    expect(workbench.layout.getAreaPresentation("side")).toBe("floating");
    expect(workbench.layout.getLayout().areas.side?.widgets).toHaveLength(1);

    await workbench.commands.executeCommand("keep-alive.example.showAttached");
    expect(workbench.layout.getAreaPresentation("side")).toBe("docked");
    expect(workbench.layout.getLayout().areas.side?.widgets).toHaveLength(1);
  });
});
