import { describe, expect, test } from "bun:test";
import { toWorkbenchNavigationTarget, toWorkbenchNavigationTargetResult } from "./extension-navigation-target";

describe("toWorkbenchNavigationTarget", () => {
  test("keeps host command references in the host command namespace", () => {
    expect(
      toWorkbenchNavigationTarget({
        kind: "command",
        target: {
          command: { extensionId: "pstdio", kind: "command", id: "workbench.action.switchMode" },
          params: { modeId: "pstdio.extension-lab.mode.lab" },
        },
      }),
    ).toEqual({
      kind: "command",
      commandId: "workbench.action.switchMode",
      args: { modeId: "pstdio.extension-lab.mode.lab" },
    });
  });

  test("resolves host view references to the host's registered id", () => {
    expect(
      toWorkbenchNavigationTarget(
        {
          kind: "view",
          view: { extensionId: "pstdio", kind: "view", id: "workspaces" },
        },
        { extensionId: "pstdio.pstdio-planner" },
      ),
    ).toEqual({ kind: "view", viewId: "workspaces", input: {} });
  });

  test("maps view replace-invoking to a host-owned panel replacement strategy", () => {
    expect(
      toWorkbenchNavigationTarget(
        {
          kind: "view",
          view: { kind: "view", id: "ticketInspector" },
          input: { strategy: "replace-invoking" },
        },
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
        view: { kind: "view", id: "ticketInspector" },
        input: { strategy: "replace-invoking" },
      }),
    ).toThrow("replace-invoking requires a live source placement.");
  });

  test("normalizes page targets and their contextual parents to the calling extension", () => {
    expect(
      toWorkbenchNavigationTarget(
        {
          kind: "page",
          page: { kind: "page", id: "workspace" },
          resource: { type: "workspace", id: "WS-1" },
          parent: {
            kind: "page",
            page: { kind: "page", id: "ticket" },
            resource: { type: "ticket", id: "PS-326" },
          },
        },
        { extensionId: "pstdio.planner" },
      ),
    ).toEqual({
      kind: "page",
      page: { extensionId: "pstdio.planner", kind: "page", id: "workspace" },
      resource: { type: "workspace", id: "WS-1" },
      parent: {
        kind: "page",
        page: { extensionId: "pstdio.planner", kind: "page", id: "ticket" },
        resource: { type: "ticket", id: "PS-326" },
      },
    });
  });

  test("normalizes page-slot and mode-placement panel owners in a compound target", () => {
    expect(
      toWorkbenchNavigationTargetResult(
        {
          kind: "compound",
          targets: [
            { kind: "page", page: { kind: "page", id: "ticket" } },
            {
              kind: "panel",
              panel: { kind: "page-slot", page: { kind: "page", id: "ticket" }, id: "emoji" },
            },
            { kind: "panel", panel: { kind: "placement", id: "sessions" } },
          ],
        },
        { extensionId: "pstdio.planner" },
      ),
    ).toEqual({
      kind: "compound",
      targets: [
        {
          kind: "page",
          page: { extensionId: "pstdio.planner", kind: "page", id: "ticket" },
        },
        {
          kind: "panel",
          panel: {
            kind: "page-slot",
            page: { extensionId: "pstdio.planner", kind: "page", id: "ticket" },
            id: "emoji",
          },
        },
        {
          kind: "panel",
          panel: { extensionId: "pstdio.planner", kind: "placement", id: "sessions" },
        },
      ],
    });
  });

  test("rejects a dynamic compound whose page is not first", () => {
    expect(() =>
      toWorkbenchNavigationTargetResult({
        kind: "compound",
        targets: [
          { kind: "panel", panel: { kind: "placement", id: "sessions" } },
          { kind: "page", page: { kind: "page", id: "ticket" } },
        ],
      }),
    ).toThrow("Renderer callback returned an invalid navigation target.");
  });
});
