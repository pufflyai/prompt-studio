import { describe, expect, test } from "bun:test";
import {
  FILE_SECTION_NAVIGATION_METADATA_KEY,
  getFileSectionNavigation,
  resolveFileSectionTargetId,
  shouldClearFileSectionSelection,
} from "../../../core/registries/renderers/file-section-navigation";
import { createFileRendererLoadKey, isCurrentLoadedFile } from "./file-renderer-load-key";

describe("file renderer loaded state", () => {
  test("does not treat content loaded for one renderer as current for another renderer", () => {
    const markdownLoadKey = createFileRendererLoadKey({
      fileRendererId: "file-renderer.story.markdown",
      resource: undefined,
    });
    const codeLoadKey = createFileRendererLoadKey({
      fileRendererId: "file-renderer.story.code",
      resource: undefined,
    });

    expect(isCurrentLoadedFile({ loadKey: markdownLoadKey }, codeLoadKey)).toBe(false);
  });

  test("treats two documents selected through resource metadata as different documents", () => {
    const bodyLoadKey = createFileRendererLoadKey({
      fileRendererId: "planner.ticketContent",
      resource: {
        kind: "ticket",
        uri: "dashboard-workbench://ticket/ticket-1",
        metadata: { documentId: "ticket-body" },
      },
    });
    const fileLoadKey = createFileRendererLoadKey({
      fileRendererId: "planner.ticketContent",
      resource: {
        kind: "ticket",
        uri: "dashboard-workbench://ticket/ticket-1",
        metadata: { documentId: "file-1" },
      },
    });

    expect(isCurrentLoadedFile({ loadKey: bodyLoadKey }, fileLoadKey)).toBe(false);
  });

  test("keeps one document stable when unrelated metadata is reordered", () => {
    const first = createFileRendererLoadKey({
      fileRendererId: "planner.ticketContent",
      resource: {
        kind: "ticket",
        uri: "dashboard-workbench://ticket/ticket-1",
        metadata: { documentId: "file-1", nested: { projectId: "proj-1", workspaceId: "workspace-1" } },
      },
    });
    const second = createFileRendererLoadKey({
      fileRendererId: "planner.ticketContent",
      resource: {
        kind: "ticket",
        uri: "dashboard-workbench://ticket/ticket-1",
        metadata: { nested: { workspaceId: "workspace-1", projectId: "proj-1" }, documentId: "file-1" },
      },
    });

    expect(isCurrentLoadedFile({ loadKey: first }, second)).toBe(true);
  });
});

describe("file renderer section navigation", () => {
  test("reads a typed section target from resource metadata", () => {
    const navigation = {
      treeId: "guide.outline",
      targetNodeId: "details-2",
      anchors: [
        { id: "details-1", heading: "Details", occurrence: 0 },
        { id: "details-2", heading: "Details", occurrence: 1 },
      ],
    };

    expect(
      getFileSectionNavigation({
        kind: "markdown",
        uri: "pstdio://file/guide",
        metadata: { [FILE_SECTION_NAVIGATION_METADATA_KEY]: navigation },
      }),
    ).toEqual(navigation);
  });

  test("ignores invalid or stale section metadata", () => {
    expect(
      getFileSectionNavigation({
        kind: "markdown",
        uri: "pstdio://file/guide",
        metadata: { [FILE_SECTION_NAVIGATION_METADATA_KEY]: { treeId: "guide.outline", anchors: [] } },
      }),
    ).toBeUndefined();
  });

  test("preserves selection on refresh and clears it when the document changes", () => {
    const previous = {
      resourceUri: "pstdio://file/guide",
      treeId: "guide.outline",
      anchorIds: ["intro", "details"],
    };
    const current = {
      treeId: "guide.outline",
      targetNodeId: "details",
      anchors: [
        { id: "intro", heading: "Intro" },
        { id: "details", heading: "Details" },
      ],
    };

    expect(
      shouldClearFileSectionSelection({
        previous,
        current,
        currentResourceUri: "pstdio://file/guide",
        selectedNodeId: "details",
      }),
    ).toBe(false);
    expect(
      shouldClearFileSectionSelection({
        previous,
        current: undefined,
        currentResourceUri: "pstdio://file/other",
        selectedNodeId: "details",
      }),
    ).toBe(true);
  });

  test("reopens the currently selected heading after a renderer refresh", () => {
    const navigation = {
      treeId: "guide.outline",
      targetNodeId: "intro",
      anchors: [
        { id: "intro", heading: "Intro" },
        { id: "details", heading: "Details" },
      ],
    };

    expect(resolveFileSectionTargetId(navigation, "details")).toBe("details");
    expect(resolveFileSectionTargetId(navigation, "stale-section")).toBe("intro");
  });
});
