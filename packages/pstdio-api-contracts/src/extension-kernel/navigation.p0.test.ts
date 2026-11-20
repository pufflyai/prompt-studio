import { describe, expect, test } from "bun:test";
import { navigationTargetSchema } from "../extensions/navigation-target-metadata";
import { isNavigationTarget, qualifyNavigationTarget } from "./navigation";
import { resourceLinkTarget } from "./resource-link-target";

test("resource links retain semantic context while requesting an unpinned Side preview", () => {
  const target = {
    kind: "page" as const,
    page: { kind: "page" as const, extensionId: "example.records", id: "record" },
    resource: { type: "record", id: "a", metadata: { document: "body" } },
    params: { filter: "mine" },
    section: { anchors: [{ id: "intro", heading: "Introduction" }] },
    parent: { kind: "page" as const, page: { kind: "page" as const, id: "records", extensionId: "example.records" } },
    open: "pin" as const,
  };
  const preview = resourceLinkTarget(target);
  expect(preview).toEqual({ ...target, region: "side", open: "preview" });
  expect(isNavigationTarget(preview)).toBe(true);
  expect(preview).toEqual(navigationTargetSchema.parse(preview));
  const panel = {
    kind: "panel" as const,
    panel: { kind: "placement" as const, extensionId: "example.records", id: "records" },
    resource: target.resource,
  };
  const compound = resourceLinkTarget({ kind: "compound", targets: [target.parent, panel] });
  expect(compound).toEqual({ kind: "compound", targets: [{ ...panel, region: "side" }] });
  expect(compound).toEqual(navigationTargetSchema.parse(compound));
});

test("a resource link followed from Side previews in Main so its source stays visible", () => {
  const target = {
    kind: "page" as const,
    page: { kind: "page" as const, extensionId: "example.records", id: "record" },
    resource: { type: "record", id: "a" },
    params: { filter: "mine" },
  };
  const preview = resourceLinkTarget(target, { region: "side" });
  expect(preview).toEqual({ ...target, region: "main" });
  expect(preview).toEqual(navigationTargetSchema.parse(preview));
  expect(resourceLinkTarget(target, { region: "main" })).toEqual({ ...target, region: "side", open: "preview" });
});

test("panel and compound links from Side keep panels in Side and open pages in Main", () => {
  const resource = { type: "record", id: "a" };
  const panel = {
    kind: "panel" as const,
    panel: { kind: "placement" as const, extensionId: "example.records", id: "records" },
    resource,
    open: "pin" as const,
  };
  // Main does not accept panels in every mode, so a panel link stays in Side whatever its source.
  const { open: _open, ...unpinned } = panel;
  expect(resourceLinkTarget(panel, { region: "side" })).toEqual({ ...unpinned, region: "side" });
  const page = {
    kind: "page" as const,
    page: { kind: "page" as const, extensionId: "example.records", id: "record" },
    resource,
  };
  const single = resourceLinkTarget({ kind: "compound", targets: [panel] }, { region: "side" });
  expect(single).toEqual({ kind: "compound", targets: [{ ...unpinned, region: "side" }] });
  expect(single).toEqual(navigationTargetSchema.parse(single));
  const many = resourceLinkTarget({ kind: "compound", targets: [page, panel] }, { region: "side" });
  expect(many).toEqual({
    kind: "compound",
    targets: [
      { ...page, region: "main" },
      { ...panel, region: "side" },
    ],
  });
  expect(many).toEqual(navigationTargetSchema.parse(many));
  expect(resourceLinkTarget({ kind: "compound", targets: [page, panel] })).toEqual({
    kind: "compound",
    targets: [
      { ...page, region: "side" },
      { ...panel, region: "side" },
    ],
  });
});

test.each([
  "overlay",
  "sidenav",
  "invalid",
])("resource navigation rejects an invalid panel destination: %s", (region) => {
  for (const kind of ["page", "panel"]) {
    const target = {
      kind,
      [kind]: { kind: kind === "page" ? "page" : "placement", id: "record" },
      resource: { type: "record", id: "a" },
      region,
    };
    expect(isNavigationTarget(target)).toBe(false);
    expect(navigationTargetSchema.safeParse(target).success).toBe(false);
  }
});

test("an auxiliary page target requires a resource", () => {
  const target = { kind: "page", page: { kind: "page", id: "collection" }, region: "side" };
  expect(isNavigationTarget(target)).toBe(false);
  expect(navigationTargetSchema.safeParse(target).success).toBe(false);
});

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

test("dialog navigation qualifies its page and resource and rejects foreign placement addresses", () => {
  const target = {
    kind: "dialog" as const,
    page: { kind: "page" as const, id: "create" },
    params: { name: "Draft" },
    resource: { type: "folder", id: "one" },
  };
  expect(isNavigationTarget(target)).toBe(true);
  const qualified = qualifyNavigationTarget(target, "acme.tools", "project");
  expect(qualified).toMatchObject({
    kind: "dialog",
    page: { extensionId: "acme.tools" },
    resource: { extensionId: "acme.tools", projectId: "project" },
    params: target.params,
  });
  expect(qualified).toEqual(navigationTargetSchema.parse(qualified));
  expect(isNavigationTarget({ ...target, placementIdentity: {} })).toBe(false);
  expect(navigationTargetSchema.safeParse({ ...qualified, placementIdentity: {} }).success).toBe(false);
});
