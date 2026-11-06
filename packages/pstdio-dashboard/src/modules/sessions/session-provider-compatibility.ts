import { contributionRefId, sessionBrowser, workbenchPanels } from "@pstdio/sdk/extensions";
import type { Disposable, WorkbenchModuleContext } from "@pstdio/workbench";
import { registerLegacySessionCommands } from "./session-command-compatibility";
import { registerSessionPages } from "./session-pages";
import { sessionProviderTab } from "./session-provider-tab";

const legacyPanelRef = (modeId: string) =>
  modeId === "project"
    ? workbenchPanels.projectSession
    : { kind: "placement" as const, extensionId: "pstdio", id: `session.${modeId}` };

/** Legacy saved layouts and commands delegate to the same independently installed provider. */
export const registerSessionProviderCompatibility = (ctx: WorkbenchModuleContext) => {
  let pages: Disposable | undefined;
  const placements = new Map<string, Disposable>();
  const retirePlacements = (modes: Set<string>) => {
    // Disposal recomposes the active mode synchronously. Detach its alias first,
    // before another mode can refresh a binding to the removed provider view.
    const active = ctx.modes.getActiveModeId();
    if (active && !modes.has(active)) {
      placements.get(active)?.dispose();
      placements.delete(active);
    }
    for (const [modeId, registration] of placements) {
      if (modes.has(modeId)) continue;
      registration.dispose();
      placements.delete(modeId);
    }
  };
  const sync = () => {
    const available = Boolean(ctx.views.getView(contributionRefId(sessionBrowser.views.conversation)));
    const modes = new Set(available ? ["project", ...ctx.modes.listModes().map((mode) => mode.id)] : []);
    retirePlacements(modes);
    if (!available && pages) {
      pages.dispose();
      pages = undefined;
    }
    for (const modeId of modes) {
      if (placements.has(modeId)) continue;
      placements.set(
        modeId,
        ctx.modePlacements.registerPlacement({
          // Retain the old placement ID as well as its public ref so saved layouts restore.
          id: `dashboard.session-bubble.${modeId}`,
          ref: legacyPanelRef(modeId),
          modeId,
          region: "side",
          addableIn: [],
          tab: sessionProviderTab(ctx),
          item: {
            kind: "binding",
            binding: {
              kinds: [
                { kind: "resource-kind", extensionId: "pstdio", id: "session" },
                { kind: "resource-kind", extensionId: "pstdio", id: "session-draft" },
              ],
              view: sessionBrowser.views.conversation,
              cardinality: "many",
            },
          },
        }),
      );
    }
    if (available && !pages) pages = registerSessionPages(ctx);
  };
  registerLegacySessionCommands(ctx);
  sync();
  const stopViews = ctx.views.store.subscribe(sync);
  const stopModes = ctx.modes.store.subscribe(sync);
  return {
    dispose() {
      stopViews();
      stopModes();
      pages?.dispose();
      for (const item of placements.values()) item.dispose();
    },
  };
};
