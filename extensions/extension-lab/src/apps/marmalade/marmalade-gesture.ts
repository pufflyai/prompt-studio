import { useEffect, useState } from "react";
import type { MarmaladeAction } from "./marmalade.types";
import { marmaladeStore } from "./marmalade-store";

interface GestureSession {
  preview(action: MarmaladeAction): Promise<void>;
  commitPreview(): Promise<void>;
  cancelPreview(): Promise<void>;
}
const nextFrame = (run: () => void) => {
  const frame = requestAnimationFrame(run);
  return () => cancelAnimationFrame(frame);
};
/** Pointer mechanics stay local; only the latest frame preview crosses the shared session. */
export const createMarmaladeGesture = (session: GestureSession, schedule = nextFrame) => {
  let latest: MarmaladeAction | undefined;
  let stopFrame: (() => void) | undefined;
  let active = false;
  return {
    update(action: MarmaladeAction) {
      active = true;
      latest = action;
      stopFrame ??= schedule(() => {
        stopFrame = undefined;
        if (latest) void session.preview(latest);
      });
    },
    async complete(action: MarmaladeAction) {
      stopFrame?.();
      stopFrame = undefined;
      latest = undefined;
      active = false;
      const preview = session.preview(action);
      const committed = session.commitPreview();
      await Promise.all([preview, committed]);
    },
    async cancel() {
      stopFrame?.();
      stopFrame = undefined;
      latest = undefined;
      if (!active) return;
      active = false;
      await session.cancelPreview();
    },
  };
};
export const useMarmaladeGesture = () => {
  const [gesture] = useState(() => createMarmaladeGesture(marmaladeStore));
  useEffect(
    () => () => {
      void gesture.cancel();
    },
    [gesture],
  );
  return gesture;
};
