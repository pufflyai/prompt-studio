import { describe, expect, test } from "bun:test";
import { workspaceSlots } from "./index";

describe("kernel workspace slots", () => {
  test("exposes workspace shell slots owned by the kernel", () => {
    expect(workspaceSlots.headerPrimary).toMatchObject({ id: "workspace.headerPrimary", kind: "menu" });
    expect(workspaceSlots.headerOverflow).toMatchObject({ id: "workspace.headerOverflow", kind: "menu" });
    expect(workspaceSlots.tabs).toMatchObject({ id: "workspace.tabs", kind: "navigation" });
    expect(workspaceSlots.sidebar).toMatchObject({ id: "workspace.sidebar", kind: "view" });
  });
});
