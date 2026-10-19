import { workbenchPanels } from "@pstdio/sdk/extensions";
import type { Disposable, WorkbenchModuleContext } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createSessionTabPresentation } from "./session-tab-presentation";

export const sessionPanelRef = (modeId: string) =>
  modeId === "project"
    ? workbenchPanels.projectSession
    : { kind: "placement" as const, extensionId: "pstdio", id: `session.${modeId}` };

/** Sessions belong to the active project/mode, including modes contributed by extensions. */
export const registerSessionPanelPlacements = (ctx: WorkbenchModuleContext) => {
  const registrations = new Map<string, Disposable>();
  const sync = () => {
    const modeIds = new Set(["project", ...ctx.modes.listModes().map((mode) => mode.id)]);
    for (const [modeId, registration] of registrations) {
      if (modeIds.has(modeId)) continue;
      registration.dispose();
      registrations.delete(modeId);
    }
    for (const modeId of modeIds) {
      if (registrations.has(modeId)) continue;
      const registration = ctx.modePlacements.registerPlacement({
        id: `dashboard.session-bubble.${modeId}`,
        ref: sessionPanelRef(modeId),
        modeId,
        region: "side",
        item: {
          kind: "binding",
          binding: {
            kinds: [
              { kind: "resource-kind", id: "session" },
              { kind: "resource-kind", id: "session-draft" },
            ],
            view: { kind: "view", id: dashboardWidgetIds.sessionBubble },
            cardinality: "many",
            add: {
              kind: "command",
              target: { command: { kind: "command", extensionId: "pstdio", id: dashboardCommandIds.createSession } },
            },
          },
        },
        tab: createSessionTabPresentation(ctx),
      });
      registrations.set(modeId, registration);
    }
  };
  sync();
  const unsubscribe = ctx.modes.store.subscribe(sync);
  return {
    dispose() {
      unsubscribe();
      for (const registration of registrations.values()) registration.dispose();
      registrations.clear();
    },
  };
};
