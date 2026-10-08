import { expect, test } from "bun:test";
import { makeCommandContext } from "./command-context";
import { createMemoryStorage } from "./memory-storage";

test("each context allocates with its own resource prefixes", async () => {
  const storage = createMemoryStorage();

  const first = makeCommandContext({ storage, params: {}, resourcePrefixes: { ticket: "T" } });
  const second = makeCommandContext({ storage, params: {}, resourcePrefixes: { ticket: "PS" } });

  expect((await first.resources.allocate({ kind: "ticket" })).shorthand).toBe("T-1");
  expect((await second.resources.allocate({ kind: "ticket" })).shorthand).toBe("PS-2");
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
