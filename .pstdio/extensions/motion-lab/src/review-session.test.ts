import { expect, test } from "bun:test";
import { createReviewSession } from "./review-session";
import { applyReviewChange, initialState, type ReviewState } from "./review-state";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test("reconciles another view's saved edit after a pending write finishes", async () => {
  let stored: ReviewState = initialState("loaders");
  let visible = stored;
  const response = deferred<ReviewState>();
  const started = deferred<ReviewState>();
  const session = createReviewSession(stored, {
    read: async () => stored,
    write: async (change) => {
      stored = applyReviewChange(stored, change, 1000);
      started.resolve(stored);
      return response.promise;
    },
    onState: (state) => {
      visible = state;
    },
    onError: (error) => {
      throw error;
    },
  });
  await session.refresh();
  const write = session.update({ loop: true });
  const earlierResponse = await started.promise;
  stored = applyReviewChange(stored, { settings: { right: { loader: "contours" } } }, 1001);
  await session.refresh();
  response.resolve(earlierResponse);
  await write;
  expect(visible.loop).toBe(true);
  expect(visible.settings.right.loader).toBe("contours");
});

test("ignores an obsolete read and results from a disposed resource", async () => {
  const initial = initialState("loaders");
  const first = deferred<ReviewState>();
  const second = deferred<ReviewState>();
  let reads = 0;
  let visible: ReviewState = initial;
  const session = createReviewSession(initial, {
    read: () => (++reads === 1 ? first.promise : second.promise),
    write: async () => initial,
    onState: (state) => {
      visible = state;
    },
    onError: (error) => {
      throw error;
    },
  });
  const oldRead = session.refresh();
  const newRead = session.refresh();
  const latest = applyReviewChange(initial, { loop: true }, 1000);
  second.resolve(latest);
  await newRead;
  first.resolve(initial);
  await oldRead;
  expect(visible.loop).toBe(true);
  session.dispose();
  session.preview({ loop: false });
  expect(visible.loop).toBe(true);
});
