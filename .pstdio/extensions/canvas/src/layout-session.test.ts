import { expect, test } from "bun:test";
import type { Layout, LayoutChange } from "./layout";
import { createLayoutSession } from "./layout-session";

const initial: Layout = {
  version: 1,
  camera: { x: 0, y: 0, zoom: 1 },
  positions: { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
};

test("keeps failed edits visible and retries them with the next change", async () => {
  let stored = structuredClone(initial);
  let visible = stored;
  let error = "";
  let fail = true;
  const writes: LayoutChange[] = [];
  const session = createLayoutSession({
    read: async () => stored,
    write: async (change) => {
      writes.push(change);
      if (fail) throw new Error("storage unavailable");
      stored = {
        ...stored,
        camera: change.camera ?? stored.camera,
        positions: { ...stored.positions, ...change.positions },
      };
    },
    apply: (value) => {
      visible = value;
    },
    error: (value) => {
      error = value;
    },
  });
  visible = { ...initial, positions: { ...initial.positions, a: { x: 99, y: 0 } } };
  await session.save({ positions: { a: { x: 99, y: 0 } } });
  expect(visible.positions.a.x).toBe(99);
  expect(error).toContain("storage unavailable");
  await session.refresh();
  expect(visible.positions.a.x).toBe(99);
  fail = false;
  await session.save({ camera: { x: 100, y: 20, zoom: 0.5 } });
  expect(writes[1]).toEqual({ camera: { x: 100, y: 20, zoom: 0.5 }, positions: { a: { x: 99, y: 0 } } });
  expect(visible.positions.a.x).toBe(99);
  expect(error).toBe("");
});

test("ignores old reads and prevents view updates after disposal", async () => {
  let resolve!: (layout: Layout) => void;
  const deferred = new Promise<Layout>((done) => {
    resolve = done;
  });
  let visible = initial;
  let reads = 0;
  const latest = { ...initial, camera: { x: 10, y: 20, zoom: 1 } };
  const session = createLayoutSession({
    read: () => (++reads === 1 ? deferred : Promise.resolve(latest)),
    write: async () => {},
    apply: (value) => {
      visible = value;
    },
    error: () => {},
  });
  const old = session.refresh();
  await session.refresh();
  resolve(initial);
  await old;
  expect(visible).toBe(latest);
  session.dispose();
  await session.refresh();
  expect(reads).toBe(2);
});
