import { expect, test } from "bun:test";
import { readLayout } from "./layout";

const items = [
  { id: "original", position: { x: 0, y: 0 } },
  { id: "new-design", position: { x: 400, y: 0 } },
];
test("keeps source membership while reusing valid saved positions", () => {
  const saved = {
    version: 1,
    camera: { x: 120, y: -30, zoom: 1.5 },
    positions: { original: { x: 15, y: 20 }, removed: { x: 100, y: 100 } },
    hidden: ["new-design"],
    names: { original: "stale name" },
  };
  expect(readLayout(saved, items)).toEqual({
    version: 1,
    camera: saved.camera,
    positions: { original: { x: 15, y: 20 }, "new-design": { x: 400, y: 0 } },
  });
});
test("uses defaults for unknown versions, malformed storage, and invalid positions", () => {
  for (const saved of [null, "invalid", { version: 12 }, { version: 1, camera: { zoom: Infinity } }]) {
    expect(readLayout(saved, items).positions).toEqual({ original: { x: 0, y: 0 }, "new-design": { x: 400, y: 0 } });
  }
  expect(readLayout({ version: 1, positions: { original: { x: Infinity, y: 2 } } }, items).positions.original).toEqual({
    x: 0,
    y: 0,
  });
});
