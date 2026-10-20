import type { PageLocation, ResourceRef } from "@pstdio/sdk/extensions";
import type { NavigationTreeRegistry, NavigationTreeSlot } from "../../registries/navigation/navigation-tree-registry";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry";
import type { TreeViewSection } from "../../registries/renderers/tree-renderer-types";
import { settleReadBatch } from "../../registries/views/settle-read-batch";
import { resolveNavigationLevels } from "./navigation-level";

interface LevelNavigationHost {
  modes: { getActiveModeId(): string | undefined };
  pages: {
    store: {
      getState(): { location?: PageLocation; pages: Readonly<Record<string, WorkbenchPageContribution>> };
    };
  };
  navigationTrees: NavigationTreeRegistry;
  getPrimaryResource(): ResourceRef | undefined;
}

const pinnedOnly = (sections: TreeViewSection[]) =>
  sections
    .filter((section) => section.nodes.length > 0)
    .map((section) => ({ ...section, nodes: section.nodes.map((node) => ({ ...node, pinnedOnly: true })) }));

// Owners can share a section id, such as the navigation root. The first owner keeps its section settings.
const mergeSections = (sections: TreeViewSection[]) => {
  const merged = new Map<string, TreeViewSection>();
  for (const section of sections) {
    const current = merged.get(section.id);
    merged.set(section.id, current ? { ...current, nodes: [...current.nodes, ...section.nodes] } : section);
  }
  return [...merged.values()];
};

// Composes one navigation tree from the active mode and every open Sidenav level.
export const createLevelNavigation = (host: LevelNavigationHost) => {
  // The mode and every open level, from the outermost to the innermost.
  const queries = () => {
    const modeId = host.modes.getActiveModeId();
    if (!modeId) return [];
    const state = host.pages.store.getState();
    const levels = resolveNavigationLevels({
      location: state.location,
      pages: Object.values(state.pages),
      navigationTrees: host.navigationTrees,
    });
    const modeOwner = host.navigationTrees.resolveOwner("mode", modeId) ?? {
      kind: "mode" as const,
      id: modeId,
      extensionId: "pstdio",
    };
    return [
      { owner: modeOwner, resource: host.getPrimaryResource() },
      ...levels.map(({ owner, location }) => ({ owner, resource: location.resource })),
    ];
  };

  return {
    getReadKey: () =>
      JSON.stringify(queries().map(({ owner, resource }) => host.navigationTrees.getReadKey(owner, { resource }))),

    getStructure: (slot: NavigationTreeSlot) => {
      const ordered = slot === "content" ? queries().reverse() : queries();
      return mergeSections(
        ordered.flatMap(({ owner, resource }, index) => {
          const sections = host.navigationTrees.getStructure(owner, slot, { resource });
          return slot === "content" && index > 0 ? pinnedOnly(sections) : sections;
        }),
      );
    },

    async getSections(
      slot: NavigationTreeSlot,
      signal?: AbortSignal,
      onProgress?: (sections: TreeViewSection[]) => void,
    ) {
      // Header and footer rows accumulate from the mode inward; the innermost owner fills the body.
      const ordered = slot === "content" ? queries().reverse() : queries();
      const available = ordered.map(({ owner, resource }, index) => {
        const sections = host.navigationTrees.getStructure(owner, slot, { resource });
        return slot === "content" && index > 0 ? pinnedOnly(sections) : sections;
      });
      await settleReadBatch(
        ordered.map(({ owner, resource }, index) => async (signal) => {
          const publish = (sections: TreeViewSection[]) => {
            signal.throwIfAborted();
            // Outer rows remain available for items pinned to the header or footer.
            available[index] = slot === "content" && index > 0 ? pinnedOnly(sections) : sections;
            onProgress?.(mergeSections(available.flat()));
          };
          publish(await host.navigationTrees.getSections(owner, slot, { resource, signal, onProgress: publish }));
        }),
        signal,
      );
      signal?.throwIfAborted();
      return mergeSections(available.flat());
    },

    getDefaultExpandedSectionIds: () => {
      const all = queries();
      return all.flatMap(({ owner }, index) =>
        (index === all.length - 1
          ? (["header", "content", "footer"] as const)
          : (["header", "footer"] as const)
        ).flatMap((slot) => host.navigationTrees.getDefaultExpandedSectionIds(owner, slot)),
      );
    },
  };
};
