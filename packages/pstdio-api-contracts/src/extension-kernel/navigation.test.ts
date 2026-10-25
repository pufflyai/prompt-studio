import { describe, expect, test } from "bun:test";
import { navigationTargetSchema } from "../extensions/navigation-target-metadata";
import { isNavigationTarget, qualifyNavigationTarget } from "./navigation";

test("viewer navigation is caller-relative and qualifies both resource identities", () => {
  const target = {
    kind: "viewer" as const,
    operation: "switch" as const,
    from: { type: "record", id: "x" },
    resource: { type: "record", id: "y" },
  };
  expect(isNavigationTarget(target)).toBe(true);
  const qualified = qualifyNavigationTarget(target, "example.records", "project");
  expect(qualified).toMatchObject({
    from: { extensionId: "example.records", projectId: "project" },
    resource: { extensionId: "example.records", projectId: "project" },
  });
  expect(qualified).toEqual(navigationTargetSchema.parse(qualified));
  expect(isNavigationTarget({ ...target, placementIdentity: { kind: "mode", placementId: "other" } })).toBe(false);
  expect(navigationTargetSchema.safeParse({ ...qualified, placementIdentity: {} }).success).toBe(false);
});

describe("external navigation targets", () => {
  test.each([
    "https://example.com/path?q=1#section",
    "http://localhost:3000/",
    "HTTPS://example.com/",
  ])("accepts web URL %s", (href) => {
    const target = { kind: "href" as const, href };
    expect(isNavigationTarget(target)).toBe(true);
    expect(navigationTargetSchema.safeParse(target).success).toBe(true);
    expect(qualifyNavigationTarget(target, "notes")).toEqual(target);
  });

  test.each([
    "javascript:alert(1)",
    " \tJaVaScRiPt:alert(1)",
    "java\nscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "blob:https://example.com/id",
    "https://",
    "/relative",
    "//example.com/",
    "",
  ])("rejects unsafe or incomplete URL %s", (href) => {
    const target = { kind: "href" as const, href };
    expect(isNavigationTarget(target)).toBe(false);
    expect(navigationTargetSchema.safeParse(target).success).toBe(false);
    expect(() => qualifyNavigationTarget(target, "notes")).toThrow("Invalid navigation target");
  });
});

test("validates source ranges consistently at the navigation and metadata boundaries", () => {
  const base = { kind: "page", page: { kind: "page", id: "workspace", extensionId: "pstdio" } };
  for (const position of [{ line: 1 }, { line: 2, column: 4, endLine: 3, endColumn: 1 }]) {
    expect(isNavigationTarget({ ...base, position })).toBe(true);
    expect(navigationTargetSchema.safeParse({ ...base, position }).success).toBe(true);
  }
  for (const position of [
    { line: 0 },
    { line: 1.5 },
    { line: 2, endLine: 1 },
    { line: 2, endColumn: 2 },
    { line: 1, column: 3, endLine: 1, endColumn: 2 },
  ]) {
    expect(isNavigationTarget({ ...base, position })).toBe(false);
    expect(navigationTargetSchema.safeParse({ ...base, position }).success).toBe(false);
  }
  expect(isNavigationTarget({ ...base, position: { line: 1 }, section: { anchors: [] } })).toBe(false);
  expect(navigationTargetSchema.safeParse({ ...base, position: { line: 1 }, section: { anchors: [] } }).success).toBe(
    false,
  );
});

test("viewer reference targets accept one valid source position or heading section", () => {
  const base = {
    kind: "viewer",
    operation: "switch",
    from: { type: "record", id: "a" },
    resource: { type: "record", id: "b" },
  };
  for (const reference of [
    { position: { line: 3, column: 2 } },
    { section: { anchors: [{ id: "a", heading: "A" }] } },
  ]) {
    expect(isNavigationTarget({ ...base, ...reference })).toBe(true);
    expect(navigationTargetSchema.safeParse({ ...base, ...reference }).success).toBe(true);
  }
  for (const reference of [{ position: { line: 0 } }, { position: { line: 2 }, section: { anchors: [] } }]) {
    expect(isNavigationTarget({ ...base, ...reference })).toBe(false);
    expect(navigationTargetSchema.safeParse({ ...base, ...reference }).success).toBe(false);
  }
});
