import { expect, test } from "bun:test";
import { type CollectionBadgeItem, type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { loadTicketLinkedResources } from "./ticket-linked-resources";

const ticket = (id: string): ResourceRef => ({
  type: "ticket",
  id,
  extensionId: "pstdio.pstdio-planner",
  projectId: "proj-1",
});
const workspace: ResourceRef = {
  type: "workspace",
  id: "same",
  extensionId: "pstdio",
  projectId: "proj-1",
  label: "Saved workspace",
};
const artifact: ResourceRef = {
  type: "artifact",
  id: "same",
  extensionId: "example.artifacts",
  projectId: "proj-1",
  label: "Saved artifact",
};

test("one resource list deduplicates incoming and outgoing links while keeping owner identities distinct", async () => {
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: { extensionId: "pstdio.pstdio-planner" },
  });
  await ctx.resources.addAnchors(ticket("one"), [workspace, artifact]);
  await ctx.resources.addAnchors(workspace, [ticket("one"), ticket("two")]);
  let label = "Current artifact";
  const batches: ResourceRef[][] = [];
  ctx.resources.resolveOpenings = async (refs) => {
    batches.push(refs);
    return refs.map((resource) => ({
      resource: {
        ...resource,
        label: resource.type === "artifact" ? label : "Current workspace",
        icon: resource.type === "artifact" ? "file-code" : "folder",
      },
      target: { kind: "page", page: { kind: "page", id: "resource", extensionId: resource.extensionId }, resource },
    }));
  };
  const read = () => loadTicketLinkedResources(ctx.resources, [ticket("one"), ticket("two")]);
  const first = await read();
  expect(
    first
      .get("one")
      ?.map((item) => item.id)
      .sort(),
  ).toEqual([resourceKey(workspace), resourceKey(artifact)].sort());
  expect(first.get("two")).toHaveLength(1);
  expect(batches).toHaveLength(1);
  expect(batches[0]).toHaveLength(2);
  expect(first.get("one")).toContainEqual(
    expect.objectContaining({
      label: "Current artifact",
      icon: "file-code",
      action: expect.objectContaining({ kind: "page" }),
    }),
  );
  label = "Renamed artifact";
  expect((await read()).get("one")?.find((item) => item.id === resourceKey(artifact))?.label).toBe(label);
  await ctx.resources.removeAnchors(ticket("one"), [artifact]);
  expect((await read()).get("one")).toHaveLength(1);
});

test("unavailable resources retain saved labels without an activation fallback; empty tickets have no badges", async () => {
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: { extensionId: "pstdio.pstdio-planner" },
  });
  await ctx.resources.addAnchors(ticket("one"), [artifact]);
  const lookup = await loadTicketLinkedResources(ctx.resources, [ticket("one"), ticket("empty")]);
  const item: CollectionBadgeItem = lookup.get("one")![0]!;
  expect(item).toMatchObject({
    label: "Saved artifact",
    icon: "circle-alert",
    tooltip: expect.stringContaining("Unavailable"),
  });
  expect(item.action).toBeUndefined();
  expect(item.resource).toBeUndefined();
  expect(lookup.get("empty")).toEqual([]);
});

test("relationships include every page and owner resolution uses bounded batches across cards", async () => {
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: { extensionId: "pstdio.pstdio-planner" },
  });
  const refs = Array.from({ length: 105 }, (_, index) => ({ ...artifact, id: String(index) }));
  await ctx.resources.addAnchors(ticket("one"), refs);
  const sizes: number[] = [];
  ctx.resources.resolveOpenings = async (refs) => {
    sizes.push(refs.length);
    return [];
  };
  const lookup = await loadTicketLinkedResources(ctx.resources, [ticket("one")]);
  expect(lookup.get("one")).toHaveLength(105);
  expect(sizes).toEqual([100, 5]);
});
