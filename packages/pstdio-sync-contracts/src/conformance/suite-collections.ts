import { expect, test } from "bun:test";
import { own } from "./dictionary";
import type { ConformanceFactory } from "./reference";
import { textEdit } from "./suite";

export function registerCollectionCases(factory: ConformanceFactory) {
  for (const order of [
    [0, 1],
    [1, 0],
  ])
    test(`map keys and sequence edits converge with a late third client in order ${order}`, async () => {
      const { clients } = factory();
      const [a, b, c] = clients;
      await a.edit([{ recordId: "list", shared: [{ kind: "list.insert", index: 0, values: ["base"] }] }]);
      await a.sync();
      await b.sync();
      await c.sync();
      await a.edit([
        { recordId: "map", shared: [{ kind: "map.set", key: "a", value: { nested: 1 } }] },
        {
          recordId: "list",
          shared: [
            { kind: "list.delete", index: 0, count: 1 },
            { kind: "list.insert", index: 0, values: ["a"] },
          ],
        },
      ]);
      await b.edit([
        { recordId: "map", shared: [{ kind: "map.set", key: "b", value: null }] },
        { recordId: "list", shared: [{ kind: "list.insert", index: 1, values: ["b"] }] },
      ]);
      await c.edit([{ recordId: "list", shared: [{ kind: "list.insert", index: 1, values: ["late-third"] }] }]);
      await clients[order[0]].sync();
      await clients[order[1]].sync();
      await c.sync();
      await a.sync();
      await b.sync();
      const state = await a.state();
      expect(state.records.map.map).toEqual({ a: { nested: 1 }, b: null });
      expect(state.records.list.list).toEqual((await c.state()).records.list.list);
      for (const value of ["a", "b", "late-third"]) expect(state.records.list.list).toContain(value);
      expect(state.records.list.list).not.toContain("base");
      await a.edit([{ recordId: "map", shared: [{ kind: "map.delete", key: "a" }] }]);
      await a.sync();
      await b.sync();
      expect((await b.state()).records.map.map).toEqual({ b: null });
    });
  test("same-key map writes and arbitrary JSON replacements preserve entire conflicting groups", async () => {
    const {
      clients: [a, b],
    } = factory();
    await a.edit([{ recordId: "json", replace: { a: 0, b: 0 } }]);
    await a.sync();
    await b.sync();
    await a.edit([
      { recordId: "map", shared: [{ kind: "map.set", key: "key", value: "first" }] },
      { recordId: "json", replace: { a: 1, b: 0 } },
    ]);
    const branch = await b.edit([
      { recordId: "map", shared: [{ kind: "map.set", key: "key", value: "second" }] },
      textEdit("withheld", "local"),
    ]);
    const json = await b.edit([{ recordId: "json", replace: { a: 0, b: 1 } }]);
    await a.sync();
    await b.sync();
    const state = await b.state();
    expect(state.records.map.map.key).toBe("first");
    expect(state.records.withheld).toBeUndefined();
    expect(state.records.json.value).toEqual({ a: 1, b: 0 });
    expect(state.pending.map((mutation) => mutation.operationId)).toEqual([branch.operationId, json.operationId]);
    expect(state.working.map.map.key).toBe("second");
    expect(state.working.json.value).toEqual({ a: 0, b: 1 });
  });
}

export function registerDictionaryCase(factory: ConformanceFactory) {
  test("opaque identities and JSON/map property names survive durable transport", async () => {
    const {
      clients: [a, b],
      relay,
      scope,
    } = factory();
    const group = await a.edit([
      {
        recordId: "__proto__",
        shared: [
          { kind: "map.set", key: "__proto__", value: { retained: true } },
          { kind: "map.set", key: "constructor", value: "value" },
        ],
      },
      { recordId: "constructor", replace: JSON.parse('{"__proto__":{"retained":true},"constructor":"value"}') },
    ]);
    const { sealMutation } = await import("../fingerprint");
    const opaque = await sealMutation({ ...group, operationId: "constructor" });
    await relay.submit(opaque);
    await b.sync();
    const state = await b.state();
    expect(Object.hasOwn(state.records, "__proto__")).toBe(true);
    expect(state.records.__proto__.map).toEqual(JSON.parse('{"__proto__":{"retained":true},"constructor":"value"}'));
    expect(own(state.records, "constructor")!.value).toEqual(
      JSON.parse('{"__proto__":{"retained":true},"constructor":"value"}'),
    );
    expect(own((await relay.snapshot(scope)).receipts, "constructor")!.operationId).toBe("constructor");
  });
}

export function registerMapAuthoringCases(factory: ConformanceFactory) {
  test("repeated map edits synchronize their final values with original cell preconditions", async () => {
    const {
      clients: [a, b],
    } = factory();
    await a.edit([
      {
        recordId: "map",
        shared: [
          { kind: "map.set", key: "replace", value: "original" },
          { kind: "map.set", key: "remove", value: "original" },
        ],
      },
    ]);
    await a.sync();
    await b.sync();
    await a.edit([
      {
        recordId: "map",
        shared: [
          { kind: "map.set", key: "replace", value: "first" },
          { kind: "map.set", key: "replace", value: "last" },
          { kind: "map.set", key: "remove", value: "temporary" },
          { kind: "map.delete", key: "remove" },
          { kind: "map.delete", key: "restore" },
          { kind: "map.set", key: "restore", value: "restored" },
        ],
      },
    ]);
    expect((await a.sync()).status).toBe("synchronized");
    await b.sync();
    expect((await b.state()).records.map.map).toEqual({ replace: "last", restore: "restored" });
  });
  test("empty map keys survive synchronization and deletion", async () => {
    const {
      clients: [a, b],
    } = factory();
    await a.edit([{ recordId: "map", shared: [{ kind: "map.set", key: "", value: { retained: true } }] }]);
    expect((await a.sync()).status).toBe("synchronized");
    await b.sync();
    expect((await b.state()).records.map.map).toEqual({ "": { retained: true } });
    await b.edit([{ recordId: "map", shared: [{ kind: "map.delete", key: "" }] }]);
    expect((await b.sync()).status).toBe("synchronized");
    await a.sync();
    expect((await a.state()).records.map.map).toEqual({});
  });
}
