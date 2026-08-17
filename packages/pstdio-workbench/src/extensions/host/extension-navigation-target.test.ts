import { describe, expect, test } from "bun:test";
import { toWorkbenchNavigationTarget } from "./extension-navigation-target";

describe("toWorkbenchNavigationTarget", () => {
  test("maps panel replace-invoking to a host-owned panel replacement", () => {
    expect(
      toWorkbenchNavigationTarget(
        { kind: "panel", panel: "ticketInspector", input: { strategy: "replace-invoking" } },
        { sourcePlacement: { instanceId: "panel-1" } },
      ),
    ).toEqual({
      kind: "panel",
      panelId: "ticketInspector",
      input: { strategy: { kind: "replace-panel", instanceId: "panel-1" } },
    });
  });

  test("rejects replace-invoking without source placement", () => {
    expect(() =>
      toWorkbenchNavigationTarget({ kind: "panel", panel: "ticketInspector", input: { strategy: "replace-invoking" } }),
    ).toThrow("replace-invoking requires a live source placement.");
  });
});
