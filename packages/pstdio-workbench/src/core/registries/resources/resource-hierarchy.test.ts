import { describe, expect, test } from "bun:test";
import { collectResourceAncestors, maxResourceAncestryDepth } from "./resource-hierarchy";
import type { ResourceRef } from "./resource-registry";

const resource = (id: string, parent?: string): ResourceRef => ({
  kind: "test",
  uri: `pstdio://test/${id}`,
  ...(parent ? { parent: `pstdio://test/${parent}` } : {}),
});

const resolverFor = (resources: ResourceRef[]) => {
  const byUri = new Map(resources.map((entry) => [entry.uri, entry]));
  return (uri: string) => byUri.get(uri);
};

describe("collectResourceAncestors", () => {
  test("collects a normal chain nearest-first", () => {
    const leaf = resource("leaf", "parent");
    const parent = resource("parent", "root");
    const root = resource("root");

    expect(collectResourceAncestors(resolverFor([leaf, parent, root]), leaf)).toEqual([parent, root]);
  });

  test("stops at a self-cycle", () => {
    const self = resource("self", "self");
    expect(collectResourceAncestors(resolverFor([self]), self)).toEqual([]);
  });

  test("stops before repeating a two-node cycle", () => {
    const a = resource("a", "b");
    const b = resource("b", "a");
    expect(collectResourceAncestors(resolverFor([a, b]), a)).toEqual([b]);
  });

  test("caps a longer cycle before it closes", () => {
    const chain = Array.from({ length: maxResourceAncestryDepth + 4 }, (_, index) =>
      resource(String(index), String((index + 1) % (maxResourceAncestryDepth + 4))),
    );

    expect(collectResourceAncestors(resolverFor(chain), chain[0]!)).toHaveLength(maxResourceAncestryDepth);
  });

  test("truncates an acyclic chain longer than the maximum depth", () => {
    const chain = Array.from({ length: maxResourceAncestryDepth + 2 }, (_, index) =>
      resource(String(index), index === maxResourceAncestryDepth + 1 ? undefined : String(index + 1)),
    );

    expect(collectResourceAncestors(resolverFor(chain), chain[0]!).map((entry) => entry.id ?? entry.uri)).toHaveLength(
      maxResourceAncestryDepth,
    );
  });

  test("returns a partial chain when a parent cannot be resolved", () => {
    const leaf = resource("leaf", "parent");
    const parent = resource("parent", "missing");

    expect(collectResourceAncestors(resolverFor([leaf, parent]), leaf)).toEqual([parent]);
  });

  test("returns no ancestors for a resource without a parent", () => {
    const root = resource("root");
    expect(collectResourceAncestors(resolverFor([root]), root)).toEqual([]);
  });
});
