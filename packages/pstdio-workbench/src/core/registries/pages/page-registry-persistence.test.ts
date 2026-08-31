import { describe, expect, test } from "bun:test";
import type { WorkbenchPlacementState, WorkbenchPlacementStatePersistence } from "../layout/owned-placement-state";
import { getWorkbenchPageRegistryInternals } from "./page-registry-internals";
import {
  activatePage,
  activePagePlacements,
  closePlacement,
  createRegistry,
  pageIdentity,
  registerPage,
} from "./page-registry-test-support";

describe("page placement state persistence", () => {
  test("restores static open state and pinned resources without restoring previews", () => {
    let saved: WorkbenchPlacementState | undefined;
    const persistence = {
      load: (projectId: string) => (projectId === "test-project" ? saved : undefined),
      save: (projectId: string, state: WorkbenchPlacementState) => {
        if (projectId === "test-project") saved = structuredClone(state);
      },
    };
    const setup = () => {
      const registry = createRegistry(persistence);
      registerPage(registry, {
        id: "tools",
        modeId: "project",
        slots: [
          { id: "content", role: "primary", region: "main", viewId: "content" },
          {
            id: "default-tool",
            role: "auxiliary",
            region: "side",
            viewId: "default",
            defaultOpen: true,
            closable: true,
          },
          {
            id: "hidden-tool",
            role: "auxiliary",
            region: "side",
            viewId: "hidden",
            defaultOpen: false,
            closable: true,
          },
          {
            id: "inspector",
            role: "auxiliary",
            region: "side",
            cardinality: "many",
            binding: { resourceKind: "artifact", viewId: "inspector" },
          },
        ],
      });
      return registry;
    };

    const first = setup();
    activatePage(first, { pageId: "tools" });
    const firstInternals = getWorkbenchPageRegistryInternals(first);
    firstInternals.openPanel({
      kind: "panel",
      panel: {
        kind: "page-slot",
        page: { extensionId: "pstdio.test", kind: "page", id: "tools" },
        id: "hidden-tool",
      },
    });
    firstInternals.openPanel({
      kind: "panel",
      panel: {
        kind: "page-slot",
        page: { extensionId: "pstdio.test", kind: "page", id: "tools" },
        id: "inspector",
      },
      resource: { type: "artifact", id: "pinned" },
      open: "pin",
    });
    firstInternals.openPanel({
      kind: "panel",
      panel: {
        kind: "page-slot",
        page: { extensionId: "pstdio.test", kind: "page", id: "tools" },
        id: "inspector",
      },
      resource: { type: "artifact", id: "preview" },
    });
    closePlacement(first, pageIdentity("tools", "default-tool", "default"));

    const restored = setup();
    activatePage(restored, { pageId: "tools" });

    expect(activePagePlacements(restored, "default-tool")).toEqual([]);
    expect(activePagePlacements(restored, "hidden-tool")).toHaveLength(1);
    expect(
      activePagePlacements(restored, "inspector").map((placement) => [
        placement.value.resource?.id,
        placement.value.open,
      ]),
    ).toEqual([["pinned", "pin"]]);
    expect(restored.store.getState().placementState.owners).toContainEqual({
      owner: { kind: "page", pageId: "tools" },
      staticPlacements: [
        { identity: pageIdentity("tools", "default-tool", "default"), open: false },
        { identity: pageIdentity("tools", "hidden-tool", "default"), open: true },
      ],
      pinnedPlacements: [
        {
          identity: pageIdentity("tools", "inspector", "artifact:pinned"),
          resource: { type: "artifact", id: "pinned" },
        },
      ],
    });
  });

  test("drops unknown saved identities and renders only the active owner", () => {
    let saved: WorkbenchPlacementState = {
      owners: [
        {
          owner: { kind: "page", pageId: "tools" },
          staticPlacements: [{ identity: pageIdentity("tools", "removed", "default"), open: true }],
          pinnedPlacements: [
            {
              identity: pageIdentity("tools", "removed", "artifact:removed"),
              resource: { type: "artifact", id: "removed" },
            },
          ],
        },
        {
          owner: { kind: "page", pageId: "inactive" },
          staticPlacements: [{ identity: pageIdentity("inactive", "leaked", "default"), open: true }],
          pinnedPlacements: [],
        },
      ],
    };
    const registry = createRegistry({
      load: () => saved,
      save: (_projectId, state) => {
        saved = structuredClone(state);
      },
    });
    registerPage(registry, {
      id: "tools",
      modeId: "project",
      slots: [
        { id: "content", role: "primary", region: "main", viewId: "content" },
        { id: "current", role: "auxiliary", region: "side", viewId: "current", defaultOpen: true },
      ],
    });

    activatePage(registry, { pageId: "tools" });

    expect(registry.store.getState().placements.map((placement) => placement.identity)).toEqual([
      pageIdentity("tools", "content", "default"),
      pageIdentity("tools", "current", "default"),
    ]);
    expect(saved.owners).toContainEqual({
      owner: { kind: "page", pageId: "tools" },
      staticPlacements: [{ identity: pageIdentity("tools", "current", "default"), open: true }],
      pinnedPlacements: [],
    });
  });

  test("restores pinned primary instances and activates the resource named by the location", () => {
    let saved: WorkbenchPlacementState | undefined;
    const persistence: WorkbenchPlacementStatePersistence = {
      load: () => saved,
      save: (_projectId, state) => {
        saved = structuredClone(state);
      },
    };
    const setup = () => {
      const registry = createRegistry(persistence);
      registerPage(registry, {
        id: "files",
        modeId: "project",
        slots: [
          {
            id: "content",
            role: "primary",
            region: "main",
            cardinality: "many",
            closable: true,
            binding: { resourceKind: "file", viewId: "editor" },
          },
        ],
      });
      return registry;
    };

    const first = setup();
    activatePage(first, { pageId: "files", resource: { type: "file", id: "pinned" }, open: "pin" });
    activatePage(first, { pageId: "files", resource: { type: "file", id: "location" } });

    const restored = setup();
    activatePage(restored, { pageId: "files", resource: { type: "file", id: "location" } });

    expect(
      activePagePlacements(restored, "content").map((placement) => [
        placement.identity.instanceKey,
        placement.value.open,
      ]),
    ).toEqual([
      ["file:location", "preview"],
      ["file:pinned", "pin"],
    ]);
    expect(restored.store.getState().reconciliation.activate.map((placement) => placement.identity)).toEqual([
      pageIdentity("files", "content", "file:location"),
    ]);
  });
});
