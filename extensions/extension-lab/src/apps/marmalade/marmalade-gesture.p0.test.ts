import { expect, test } from "bun:test";
import { createMarmaladeGesture } from "./marmalade-gesture";

test("pointer gestures publish at most once per frame, commit their final position once and discard cancellation", async () => {
  const previews: unknown[] = [];
  let commits = 0;
  let cancelled = 0;
  let frame: (() => void) | undefined;
  const gesture = createMarmaladeGesture(
    {
      getGestureBoundary: () => ({ owner: "session", history: "" }),
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
  gesture.begin("presentation");
  for (let x = 1; x <= 20; x++) gesture.update({ type: "viewport", pan: { x, y: 0 } });
  expect(previews).toEqual([]);
  frame!();
  expect(previews).toEqual([{ type: "viewport", pan: { x: 20, y: 0 } }]);
  await gesture.complete({ type: "viewport", pan: { x: 25, y: 0 } });
  expect(previews.at(-1)).toEqual({ type: "viewport", pan: { x: 25, y: 0 } });
  expect(commits).toBe(1);
  gesture.begin("presentation");
  gesture.update({ type: "viewport", pan: { x: 30, y: 0 } });
  await gesture.cancel();
  expect(frame).toBeUndefined();
  expect(cancelled).toBe(1);
  expect(commits).toBe(1);
  await gesture.cancel();
  expect(cancelled).toBe(1);
  await gesture.complete({ type: "viewport", pan: { x: 40, y: 0 } });
  expect(commits).toBe(1);
  expect(previews).toHaveLength(2);
});

for (const channel of ["document", "presentation"] as const) {
  test(`undo invalidates scheduled document frames and pointer-up while retaining ${channel} ownership`, async () => {
    const previews: unknown[] = [];
    let commits = 0;
    let boundary = { owner: "first", history: "" };
    let frame: (() => void) | undefined;
    const gesture = createMarmaladeGesture(
      {
        getGestureBoundary: () => boundary,
        preview: async (action) => {
          previews.push(action);
        },
        commitPreview: async () => {
          commits++;
        },
        cancelPreview: async () => {},
      },
      (run) => {
        frame = run;
        return () => {
          frame = undefined;
        };
      },
    );
    const action = { type: "position", id: "title", x: 140 } as const;
    gesture.begin(channel);
    gesture.update(action);
    boundary = { ...boundary, history: "undo" };
    frame!();
    gesture.update(action);
    await gesture.complete(action);
    expect(previews).toHaveLength(channel === "document" ? 0 : 2);
    expect(commits).toBe(channel === "document" ? 0 : 1);

    gesture.begin("document");
    await gesture.complete(action);
    expect(commits).toBe(channel === "document" ? 1 : 2);
    gesture.begin("document");
    boundary = { ...boundary, owner: "replacement" };
    await gesture.complete(action);
    expect(commits).toBe(channel === "document" ? 1 : 2);
  });
}
