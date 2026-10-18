import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { ConnectWorkbenchPageRuntimeInput } from "./page-runtime";
import { removeTrayPreviews } from "./tray-preview-retention";

// Lower-level layout operations also evict previews. Remove the owner's instance
// before another declarative publication can bring it back.
export const connectTrayPreviewRemoval = (input: ConnectWorkbenchPageRuntimeInput, applying: () => boolean) => {
  let scope = input.layout.getPersistenceScope();
  return input.layout.store.subscribe((next, previous) => {
    const nextScope = input.layout.getPersistenceScope();
    const scopeChanged = scope !== nextScope;
    scope = nextScope;
    if (applying() || scopeChanged) return;
    const rendered = new Set(
      Object.values(next.layout.regions).flatMap((region) =>
        region.widgets.flatMap((widget) =>
          widget.placementIdentity ? [placementIdentityKey(widget.placementIdentity)] : [],
        ),
      ),
    );
    const state = input.registry.store.getState();
    const owned = new Set(state.placements.map((entry) => placementIdentityKey(entry.identity)));
    const removed = new Set(
      Object.values(previous.layout.regions).flatMap((region) =>
        region.widgets.flatMap((widget) => {
          if (widget.tabRetention !== "preview" || !widget.placementIdentity) return [];
          const key = placementIdentityKey(widget.placementIdentity);
          return owned.has(key) && !rendered.has(key) ? [key] : [];
        }),
      ),
    );
    if (!removed.size) return;
    const pages = getWorkbenchPageRegistryInternals(input.registry);
    pages.publish(removeTrayPreviews(state, state, removed), "removeReplacedTrayPreviews");
  });
};
