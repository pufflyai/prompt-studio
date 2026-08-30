import { describe, expect, test } from "bun:test";
import { FILE_SECTION_NAVIGATION_METADATA_KEY } from "../../core/registries/renderers/file-section-navigation";
import { toWorkbenchActivationResult, toWorkbenchNavigationTarget } from "./extension-navigation-target";

describe("toWorkbenchNavigationTarget", () => {
  test("keeps host command references in the host command namespace", () => {
    expect(
      toWorkbenchNavigationTarget({
        kind: "command",
        target: {
          command: { extensionId: "pstdio", kind: "command", id: "workbench.action.switchMode" },
          params: { modeId: "lab" },
        },
      }),
    ).toEqual({
      kind: "command",
      commandId: "workbench.action.switchMode",
      args: { modeId: "lab" },
    });
  });

  test("resolves extension page refs to normalized page ids with the resource argument", () => {
    expect(
      toWorkbenchNavigationTarget(
        {
          kind: "page",
          page: { kind: "page", id: "tickets" },
          resource: { type: "ticket", id: "PS-1", label: "PS-1" },
          open: "pin",
        },
        { extensionId: "pstdio.pstdio-planner" },
      ),
    ).toEqual({
      kind: "page",
      pageId: "pstdio.pstdio-planner.page.tickets",
      resource: {
        kind: "ticket",
        uri: "pstdio://extension-resource/ticket/PS-1",
        id: "PS-1",
        label: "PS-1",
        icon: undefined,
        metadata: undefined,
      },
      open: "pin",
    });
  });

  test("resolves host page refs to the host's registered page id", () => {
    expect(
      toWorkbenchNavigationTarget(
        {
          kind: "page",
          page: { extensionId: "pstdio", kind: "page", id: "workspaces" },
          resource: { type: "workspace", id: "ws-1" },
        },
        { extensionId: "pstdio.pstdio-planner" },
      ),
    ).toMatchObject({ kind: "page", pageId: "workspaces" });
  });

  test("encodes a section deep link on the resource metadata", () => {
    const converted = toWorkbenchNavigationTarget(
      {
        kind: "page",
        page: { kind: "page", id: "docs" },
        resource: { type: "guide", id: "readme", label: "Readme" },
        section: { anchors: [{ id: "intro", heading: "Intro" }] },
      },
      { extensionId: "pstdio.lab", sectionSource: { treeId: "pstdio.lab.view.tree", targetNodeId: "node-1" } },
    );

    expect(converted).toMatchObject({
      kind: "page",
      pageId: "pstdio.lab.page.docs",
      resource: {
        kind: "guide",
        metadata: {
          [FILE_SECTION_NAVIGATION_METADATA_KEY]: {
            treeId: "pstdio.lab.view.tree",
            targetNodeId: "node-1",
            anchors: [{ id: "intro", heading: "Intro" }],
          },
        },
      },
    });
  });
});

describe("toWorkbenchActivationResult", () => {
  test("maps an emission to a workbench resource with the open intent", () => {
    expect(toWorkbenchActivationResult({ resource: { type: "ticket", id: "PS-2" }, open: "pin" })).toMatchObject({
      kind: "emission",
      resource: { kind: "ticket", id: "PS-2", uri: "pstdio://extension-resource/ticket/PS-2" },
      open: "pin",
    });
  });

  test("maps a navigation target to a host target", () => {
    expect(
      toWorkbenchActivationResult(
        { kind: "page", page: { kind: "page", id: "tickets" } },
        { extensionId: "pstdio.pstdio-planner" },
      ),
    ).toEqual({
      kind: "target",
      target: { kind: "page", pageId: "pstdio.pstdio-planner.page.tickets" },
    });
  });

  test("returns undefined for empty results and rejects invalid shapes", () => {
    expect(toWorkbenchActivationResult(undefined)).toBeUndefined();
    expect(toWorkbenchActivationResult(null)).toBeUndefined();
    expect(() => toWorkbenchActivationResult({ kind: "view", view: { id: "x" } })).toThrow(
      "Renderer callback returned an invalid navigation target.",
    );
  });
});
