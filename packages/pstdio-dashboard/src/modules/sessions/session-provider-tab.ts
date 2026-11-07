import { sessionBrowser } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext, WorkbenchWidgetTab } from "@pstdio/workbench";

/** Legacy definitions delegate presentation to the installed provider, including later re-registration. */
export const sessionProviderTab = (ctx: WorkbenchModuleContext): WorkbenchWidgetTab => {
  const current = () => ctx.modePlacements.getPlacement(sessionBrowser.panels.conversation)?.tab;
  return {
    getSnapshot: (instance) => current()?.getSnapshot(instance) ?? {},
    subscribe(listener) {
      let delegate = current();
      let subscription = delegate?.subscribe?.(listener);
      const release = () => {
        if (typeof subscription === "function") subscription();
        else subscription?.dispose();
      };
      const registration = ctx.modePlacements.onDidChange(() => {
        const next = current();
        if (next === delegate) return;
        release();
        delegate = next;
        subscription = delegate?.subscribe?.(listener);
        listener();
      });
      return () => {
        registration.dispose();
        release();
      };
    },
  };
};
