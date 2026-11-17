import { createWorkbenchStore } from "../../core/shared/store/workbench-store";
import { runWorkbenchEffect } from "../../core/shared/workbench-effect";

// Every patch updates the model in order. Views can skip intermediate transcripts before
// paint, while an edit, approval, or other non-transcript change wakes them immediately.
export const createChatProjection = <State extends object>(initialState: State) => {
  const store = createWorkbenchStore({ name: "workbench.chat", initialState });
  const views = new Set<() => void>();
  let immediate = false;
  let frame: number | undefined;
  const paint = () => {
    frame = undefined;
    for (const notify of views) runWorkbenchEffect("chat view subscriber", notify);
  };
  const cancel = () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
  };
  store.subscribe(() => {
    const transcriptOnly = !immediate;
    immediate = false;
    if (!views.size) return;
    if (transcriptOnly && typeof requestAnimationFrame === "function") {
      frame ??= requestAnimationFrame(paint);
      return;
    }
    cancel();
    paint();
  });
  return {
    subscriptions: {
      subscribe: store.subscribe,
      subscribeToView(notify: () => void) {
        views.add(notify);
        return () => {
          views.delete(notify);
          if (!views.size) cancel();
        };
      },
    },
    publish(snapshot: State, transcriptOnly = false) {
      // A later patch in the same workbench batch must not defer an earlier control or draft edit.
      immediate ||= !transcriptOnly;
      store.setState(snapshot, true, "projectChat");
    },
    retire(snapshot: State) {
      immediate = true;
      store.setState(snapshot, true, "retireChat");
    },
    dispose() {
      cancel();
      views.clear();
      store.dispose();
    },
  };
};
