import { describe, expect, test } from "bun:test";
import { toWorkbenchNavigationTarget } from "./extension-navigation-target";

describe("toWorkbenchNavigationTarget", () => {
  test("maps view replace-invoking to a host-owned panel replacement strategy", () => {
    expect(
      toWorkbenchNavigationTarget(
        { kind: "view", viewId: "ticketInspector", input: { strategy: "replace-invoking" } },
        { sourcePlacement: { instanceId: "panel-1" } },
      ),
    ).toEqual({
      kind: "view",
      viewId: "ticketInspector",
      input: { strategy: { kind: "replace-panel", instanceId: "panel-1" } },
    });
  });

  test("rejects a sectioned resource target without a resourceOf translator", () => {
    expect(() =>
      toWorkbenchNavigationTarget({
        kind: "resource",
        resource: { type: "guide", id: "readme", label: "Readme" },
        section: { anchors: [{ id: "intro", heading: "Intro" }] },
      }),
    ).toThrow("Resource targets with a section need a resourceOf translator");
  });

  test("passes the sectioned target through the resourceOf translator", () => {
    const converted = toWorkbenchNavigationTarget(
      {
        kind: "resource",
        resource: { type: "guide", id: "readme", label: "Readme" },
        section: { anchors: [{ id: "intro", heading: "Intro" }] },
      },
      {
        resourceOf: (resource, target) => ({
          kind: resource.type,
          uri: `test://${resource.id}`,
          id: resource.id,
          label: resource.label,
          metadata: { anchors: target.section?.anchors.length },
        }),
      },
    );

    expect(converted).toEqual({
      kind: "resource",
      resource: {
        kind: "guide",
        uri: "test://readme",
        id: "readme",
        label: "Readme",
        metadata: { anchors: 1 },
      },
      input: {},
    });
  });

  test("rejects replace-invoking without source placement", () => {
    expect(() =>
      toWorkbenchNavigationTarget({
        kind: "view",
        viewId: "ticketInspector",
        input: { strategy: "replace-invoking" },
      }),
    ).toThrow("replace-invoking requires a live source placement.");
  });
});
