import { useEffect, useState } from "react";
import type { MarmaladeAction } from "./marmalade.types";
import { marmaladeStore } from "./marmalade-store";

interface GestureSession {
  getGestureBoundary(): { owner: unknown; history: string };
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
  let boundary = session.getGestureBoundary();
  let channel: "document" | "presentation" = "document";
  const isCurrent = () => {
    const current = session.getGestureBoundary();
    return (
      active && boundary.owner === current.owner && (channel === "presentation" || boundary.history === current.history)
    );
  };
  const clearFrame = () => {
    stopFrame?.();
    stopFrame = undefined;
    latest = undefined;
  };
  return {
    begin(nextChannel: "document" | "presentation") {
      clearFrame();
      boundary = session.getGestureBoundary();
      channel = nextChannel;
      active = true;
    },
    isCurrent,
    update(action: MarmaladeAction) {
      if (!isCurrent()) return clearFrame();
      latest = action;
      stopFrame ??= schedule(() => {
        stopFrame = undefined;
        if (latest && isCurrent()) void session.preview(latest);
      });
    },
    async complete(action: MarmaladeAction) {
      const current = isCurrent();
      clearFrame();
      active = false;
      if (!current) return;
      const preview = session.preview(action);
      const committed = session.commitPreview();
      await Promise.all([preview, committed]);
    },
    async cancel() {
      const current = isCurrent();
      clearFrame();
      active = false;
      if (current) await session.cancelPreview();
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
