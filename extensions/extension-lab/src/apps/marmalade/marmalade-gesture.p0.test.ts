import { expect, test } from "bun:test";
import { createMarmaladeGesture } from "./marmalade-gesture";

test("pointer gestures publish at most once per frame, commit their final position once and discard cancellation", async () => {
  const previews: unknown[] = [];
  let commits = 0;
  let cancelled = 0;
  let frame: (() => void) | undefined;
  const gesture = createMarmaladeGesture(
    {
      preview: async (action) => {
        previews.push(action);
      },
      commitPreview: async () => {
        commits++;
      },
      cancelPreview: async () => {
        cancelled++;
      },
    },
    (run) => {
      frame = run;
      return () => {
        frame = undefined;
      };
    },
  );
  for (let x = 1; x <= 20; x++) gesture.update({ type: "viewport", pan: { x, y: 0 } });
  expect(previews).toEqual([]);
  frame!();
  expect(previews).toEqual([{ type: "viewport", pan: { x: 20, y: 0 } }]);
  await gesture.complete({ type: "viewport", pan: { x: 25, y: 0 } });
  expect(previews.at(-1)).toEqual({ type: "viewport", pan: { x: 25, y: 0 } });
  expect(commits).toBe(1);
  gesture.update({ type: "viewport", pan: { x: 30, y: 0 } });
  await gesture.cancel();
  expect(frame).toBeUndefined();
  expect(cancelled).toBe(1);
  expect(commits).toBe(1);
  await gesture.cancel();
  expect(cancelled).toBe(1);
});
