import { expect, test } from "bun:test";
import { makeCommandContext } from "./command-context";
import { createMemoryStorage } from "./memory-storage";

test("resource identity batches preserve request order and unknown IDs", async () => {
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {}, resourcePrefixes: { ticket: "PS" } });
  const first = await ctx.resources.allocate({ kind: "ticket" });
  const second = await ctx.resources.allocate({ kind: "ticket" });
  expect(
    (await ctx.resources.identityMany({ kind: "ticket", ids: [second.id, "missing", first.id] })).map(
      (resource) => resource?.shorthand ?? null,
    ),
  ).toEqual(["PS-2", null, "PS-1"]);
});

test("each context allocates with its own resource prefixes", async () => {
  const storage = createMemoryStorage();

  const first = makeCommandContext({ storage, params: {}, resourcePrefixes: { ticket: "T" } });
  const second = makeCommandContext({ storage, params: {}, resourcePrefixes: { ticket: "PS" } });

  expect((await first.resources.allocate({ kind: "ticket" })).shorthand).toBe("T-1");
  expect((await second.resources.allocate({ kind: "ticket" })).shorthand).toBe("PS-2");
});

test("resource allocation opts into compact IDs without consuming numbers for invalid prefixes", async () => {
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {}, resourcePrefixes: { ticket: "PS" } });
  await expect(ctx.resources.allocate({ kind: "ticket", idPrefix: "INVALID" })).rejects.toThrow("ID prefix");
  const first = await ctx.resources.allocate({ kind: "ticket", idPrefix: "tk" });
  expect(first).toMatchObject({ id: expect.stringMatching(/^tk_[0-9A-Za-z]{22}$/), shorthand: "PS-1" });
  const second = await ctx.resources.allocate({ kind: "ticket" });
  expect(second.shorthand).toBe("PS-2");
  expect(second.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("contexts sharing storage query cross-owner links and committed removals", async () => {
  const storage = createMemoryStorage();
  const notes = makeCommandContext({ storage, params: {}, overrides: { extensionId: "example.notes" } });
  const art = makeCommandContext({ storage, params: {}, overrides: { extensionId: "example.art" } });
  const source = { type: "item", id: "one" };
  const target = { type: "item", id: "two", extensionId: "example.art", role: "result" as const };
  await notes.resources.addAnchors(source, [target]);
  await notes.resources.addAnchors(source, [target]);
  expect((await art.resources.listAnchors({ resource: target, direction: "incoming" })).items).toHaveLength(1);
  await art.resources.removed(target);
  expect((await notes.resources.listAnchors({ resource: source })).items).toEqual([]);
  expect(await notes.resources.queryAnchors({ resource: source })).toEqual({ items: [], nextCursor: null });
});

test("resource link memory pagination visits mixed-case identities once", async () => {
  const { createMemoryResourceLinks } = await import("./memory-resource-links");
  const api = createMemoryResourceLinks({ projectId: "p", extensionId: "example.notes", edges: new Map() });
  const source = { type: "item", id: "source" };
  await api.addAnchors(
    source,
    ["a", "B", "A", "b"].map((id) => ({ type: "item", id })),
  );
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await api.listAnchors({ resource: source, limit: 1, cursor });
    ids.push(...page.items.map(({ target }) => target.id));
    cursor = page.nextCursor;
  } while (cursor);
  expect(new Set(ids)).toEqual(new Set(["a", "B", "A", "b"]));
  expect(ids).toHaveLength(4);
});

test("namespace overrides preserve the remaining host methods and settings", async () => {
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: { sessions: { get: async () => null } },
  });
  expect(await ctx.sessions.query()).toEqual({ items: [], nextCursor: null });
  await ctx.settings.set("mode", "review");
  expect(await ctx.settings.get("mode")).toBe("review");
  expect(() => ctx.logger.warn("A warning")).not.toThrow();
});

test("commands use the storage the test owns", async () => {
  const storage = createMemoryStorage();
  const override = createMemoryStorage();

  expect(makeCommandContext({ storage, params: {} }).storage).toBe(storage);
  expect(makeCommandContext({ storage, params: {}, overrides: { storage: override } }).storage).toBe(override);
});

test("workspace and session anchor writes use the shared resource links", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const ticket = { type: "ticket", id: "ticket-1" };
  await ctx.workspaces.addAnchors("workspace-1", [ticket]);
  await ctx.sessions.addAnchors("session-1", [ticket]);
  const links = await ctx.resources.listAnchors({ resource: ticket, direction: "incoming" });
  expect(links.items.map(({ source }) => source.id).sort()).toEqual(["session-1", "workspace-1"]);
});

test("contexts read core identities allocated by an earlier context", async () => {
  const storage = createMemoryStorage();
  const first = makeCommandContext({ storage, params: {}, resourcePrefixes: { ticket: "PS" } });
  const allocated = await first.resources.allocate({ kind: "ticket" });
  const second = makeCommandContext({ storage, params: {}, resourcePrefixes: { ticket: "PS" } });
  const identity = { ...allocated, kind: "ticket", aliases: [] };
  expect(await second.resources.identity({ kind: "ticket", id: allocated.id })).toEqual(identity);
  expect(await second.resources.findByShorthand({ kind: "ticket", shorthand: allocated.shorthand })).toEqual([
    identity,
  ]);
  expect(await second.resources.identity({ kind: "report", id: allocated.id })).toBeNull();
  expect(await second.resources.findByShorthand({ kind: "ticket", shorthand: "PS-999" })).toEqual([]);
});

test("resource identity lookup stays within its project and extension", async () => {
  const storage = createMemoryStorage();
  const first = makeCommandContext({ storage, params: {}, resourcePrefixes: { ticket: "PS" } });
  const allocated = await first.resources.allocate({ kind: "ticket" });
  for (const other of [
    makeCommandContext({ storage, params: {}, projectId: "other" }),
    makeCommandContext({ storage, params: {}, overrides: { extensionId: "other.extension" } }),
  ]) {
    expect(await other.resources.identity({ kind: "ticket", id: allocated.id })).toBeNull();
    expect(await other.resources.findByShorthand({ kind: "ticket", shorthand: allocated.shorthand })).toEqual([]);
  }
});
