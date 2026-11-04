import { expect, test } from "bun:test";
import {
  applyJsonChanges,
  jsonPointer,
  observeJson,
  parseJsonPointer,
  replacementChanges,
  stampJsonChanges,
  unchangedJsonPaths,
} from "./ordered-json";

test("portable observations preserve different fields across a later replacement without copying old content", async () => {
  const original = { title: "Initial\n".repeat(100_000), column: "todo", labels: ["seed"] };
  const observed = JSON.parse(JSON.stringify(await observeJson(original)));
  expect(JSON.stringify(observed).length).toBeLessThan(500);
  const moved = await replacementChanges(observed, { ...original, column: "doing" });
  const renamed = await replacementChanges(observed, { ...original, title: "Ship\nDesktop", labels: ["desktop"] });
  expect(applyJsonChanges(applyJsonChanges(original, moved), renamed)).toEqual({
    title: "Ship\nDesktop",
    column: "doing",
    labels: ["desktop"],
  });
  expect(original.column).toBe("todo");
});

test("independent new nested fields share their object while empty and changed-type objects remain explicit", async () => {
  const observed = await observeJson({});
  const model = await replacementChanges(observed, { config: { model: "small" } });
  const theme = await replacementChanges(observed, { config: { theme: "dark" } });
  expect(applyJsonChanges(applyJsonChanges({}, model), theme)).toEqual({ config: { model: "small", theme: "dark" } });
  expect(applyJsonChanges({}, await replacementChanges(observed, { config: {} }))).toEqual({ config: {} });
  const scalar = await observeJson({ config: "scalar" });
  const replaceType = await replacementChanges(scalar, { config: { theme: "dark" } });
  expect(applyJsonChanges({ config: { model: "remote" } }, replaceType)).toEqual({ config: { theme: "dark" } });
});

test("replacement removes only observed keys and preserves later unobserved siblings", async () => {
  const observed = await observeJson({ config: { old: true }, untouched: {} });
  const changes = await replacementChanges(observed, { config: {}, untouched: {} });
  expect(applyJsonChanges({ config: { old: true, new: true }, untouched: {} }, changes)).toEqual({
    config: { new: true },
    untouched: {},
  });
});

test("arrays and multiline values are replaced whole in relay order", async () => {
  for (const original of [["seed"], "Initial\ntext"]) {
    const observed = await observeJson(original);
    const first = await replacementChanges(observed, Array.isArray(original) ? ["laptop"] : "Laptop\ntext");
    const second = await replacementChanges(observed, Array.isArray(original) ? ["desktop"] : "Desktop\ntext");
    expect(applyJsonChanges(applyJsonChanges(original, first), second)).toEqual(
      Array.isArray(original) ? ["desktop"] : "Desktop\ntext",
    );
  }
});

test("conditions detect ABA and parent writes while admitting an unrelated sibling change", () => {
  const seed = { "/model": "seed", "/theme": "seed" };
  const careful = [{ path: ["model"], set: "careful" }];
  const sibling = stampJsonChanges(seed, [{ path: ["theme"], set: "dark" }], "sibling");
  expect(unchangedJsonPaths(seed, sibling, careful)).toBe(true);
  const changed = stampJsonChanges(seed, [{ path: ["model"], set: "large" }], "changed");
  const back = stampJsonChanges(changed, [{ path: ["model"], set: "small" }], "back");
  expect(unchangedJsonPaths(seed, back, careful)).toBe(false);
  const parent = stampJsonChanges(seed, [{ path: [], set: { model: "small" } }], "parent");
  expect(unchangedJsonPaths(seed, parent, careful)).toBe(false);
});

test("a wide plain save applies every field without changing its observed predecessor", () => {
  const original = Object.fromEntries(Array.from({ length: 10_000 }, (_, index) => [`field${index}`, index]));
  const changes = Object.entries(original).map(([key, value]) => ({ path: [key], set: value + 1 }));
  const stamps = Object.fromEntries(Object.keys(original).map((key) => [jsonPointer([key]), "seed"]));
  const expected = Object.fromEntries(Object.entries(original).map(([key, value]) => [key, value + 1]));
  expect(applyJsonChanges(original, changes)).toEqual(expected);
  const next = stampJsonChanges(stamps, changes, "wide");
  expect(Object.values(next).every((stamp) => stamp === "wide")).toBe(true);
  expect(unchangedJsonPaths(stamps, next, changes)).toBe(false);
  expect(original.field0).toBe(0);
  expect(stamps["/field0"]).toBe("seed");
});

test("literal JSON keys survive pointers and writes without affecting prototypes", async () => {
  const path = ["", "a/b", "~", "dot.key", "0", "__proto__"];
  expect(parseJsonPointer(jsonPointer(path))).toEqual(path);
  expect(() => parseJsonPointer("/bad~2key")).toThrow();
  const original = JSON.parse('{"__proto__":{"old":true},"constructor":{},"a/b":1}');
  const replacement = JSON.parse('{"__proto__":{"new":true},"constructor":{},"a/b":2}');
  const changes = await replacementChanges(await observeJson(original), replacement);
  expect(applyJsonChanges(original, changes)).toEqual(replacement);
  expect(Object.getPrototypeOf(applyJsonChanges({}, [{ path: ["__proto__"], set: { safe: true } }]))).toBe(
    Object.prototype,
  );
  expect(() =>
    applyJsonChanges({}, [
      { path: ["a"], set: {} },
      { path: ["a-"], set: true },
      { path: ["a", "b"], set: true },
    ]),
  ).toThrow();
});
