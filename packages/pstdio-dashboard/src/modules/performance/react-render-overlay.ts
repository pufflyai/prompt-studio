interface RenderOverlayOptions {
  isSupported(): boolean;
  load(): Promise<() => () => void>;
}

export const createReactRenderOverlay = ({ isSupported, load }: RenderOverlayOptions) => {
  let stop: (() => void) | undefined;
  let pending: Promise<void> | undefined;

  return {
    state: () => ({ supported: isSupported(), enabled: Boolean(stop), scope: "workbench" as const }),
    async setEnabled(enabled: boolean) {
      if (!enabled) {
        pending = undefined;
        stop?.();
        stop = undefined;
        return;
      }
      if (!isSupported()) throw new Error("React Scan is unavailable in this build");
      if (stop || pending) return pending;
      const start = load().then((startSession) => {
        if (pending === start) stop = startSession();
      });
      pending = start;
      try {
        await start;
      } finally {
        if (pending === start) pending = undefined;
      }
    },
  };
};

export type ReactRenderOverlay = ReturnType<typeof createReactRenderOverlay>;
