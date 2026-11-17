import { createWorkbenchStore } from "../../core/shared/store/workbench-store";

// Every patch updates the model in order. Views can skip intermediate transcripts before
// paint, while an edit, approval, or other non-transcript change wakes them immediately.
export const createChatProjection = <State extends object>(initialState: State) => {
  const store = createWorkbenchStore({ name: "workbench.chat", initialState });
  const views = new Set<() => void>();
  let transcriptUpdate: State | undefined;
  let frame: number | undefined;
  const paint = () => {
    frame = undefined;
    for (const notify of views) notify();
  };
  const cancel = () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
  };
  store.subscribe((snapshot) => {
    if (!views.size) return;
    if (snapshot === transcriptUpdate && typeof requestAnimationFrame === "function") {
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
      transcriptUpdate = transcriptOnly ? snapshot : undefined;
      store.setState(snapshot, true, "projectChat");
    },
    retire: (snapshot: State) => store.setState(snapshot, true, "retireChat"),
    dispose() {
      cancel();
      views.clear();
      store.dispose();
    },
  };
};
