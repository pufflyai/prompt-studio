import { expect, test } from "bun:test";
import { isNavigationTarget, type PageRef, type ResourceRef } from "@pstdio/sdk/extensions";
import { resolveResourcePath } from "./resource-path-resolution";

const extensionId = "acme.planner";
const kind = {
  id: "acme.planner.ticket",
  localId: "ticket",
  extensionId,
  icon: "component",
  paths: [{ prefix: "tickets/", resolveCommand: "acme.planner.command.open-path" }],
};
const resolution = {
  resource: { type: "ticket", id: "t1", label: "T-1 Fix links" },
  target: { kind: "page", page: { kind: "page", id: "ticket" }, resource: { type: "ticket", id: "t1" } },
};
const documentKey = (page: PageRef) => (page.id === "ticket" ? "ticketDocument" : undefined);
const savedDocument = { type: "ticket", id: "t1", metadata: { ticketDocument: "files/notes.md" } };

test("a claimed path resolves to its owner's resource and qualified destination", async () => {
  const calls: unknown[] = [];
  const result = await resolveResourcePath({
    projectId: "project",
    workspaceId: "workspace",
    path: "tickets/T-1/ticket.md",
    kinds: [kind],
    documentKey,
    execute: async (command, params) => {
      calls.push({ command, params });
      return resolution;
    },
  });
  expect(calls).toEqual([
    { command: kind.paths[0]!.resolveCommand, params: { path: "tickets/T-1/ticket.md", workspaceId: "workspace" } },
  ]);
  expect(result).toMatchObject({
    resource: { ...resolution.resource, icon: "component", extensionId, projectId: "project" },
    target: { page: { extensionId, id: "ticket" }, resource: { extensionId, projectId: "project" } },
  });
});

test("a resource icon overrides its kind's default icon", async () => {
  const result = await resolveResourcePath({
    projectId: "project",
    workspaceId: "workspace",
    path: "tickets/T-1/files/notes.md",
    kinds: [kind],
    documentKey,
    execute: async () => ({ ...resolution, resource: { ...resolution.resource, icon: "file-text" } }),
  });
  expect(result?.resource.icon).toBe("file-text");
});

test("the most specific prefix wins and unrelated paths do not invoke a handler", async () => {
  const calls: string[] = [];
  const input = {
    projectId: "project",
    workspaceId: "workspace",
    kinds: [kind, { ...kind, paths: [{ prefix: "tickets/special/", resolveCommand: "specific" }] }],
    documentKey,
    execute: async (command: string) => {
      calls.push(command);
      return resolution;
    },
  };
  expect(await resolveResourcePath({ ...input, path: "tickets-other/T-1.md" })).toBeNull();
  expect(await resolveResourcePath({ ...input, path: "src/app.ts" })).toBeNull();
  await resolveResourcePath({ ...input, path: "tickets/special/T-1.md" });
  expect(calls).toEqual(["specific"]);
});

test("missing resources fall back while foreign identities are rejected", async () => {
  const input = {
    projectId: "project",
    workspaceId: "workspace",
    path: "tickets/T-1/ticket.md",
    kinds: [kind],
    documentKey,
  };
  expect(await resolveResourcePath({ ...input, execute: async () => null })).toBeNull();
  await expect(
    resolveResourcePath({
      ...input,
      execute: async () => ({ ...resolution, resource: { ...resolution.resource, extensionId: "other" } }),
    }),
  ).rejects.toThrow("owner");
});

const pageTarget = (resource: ResourceRef) => ({ ...resolution.target, resource });
const panelTarget = (resource: ResourceRef) => ({
  kind: "panel",
  panel: { kind: "placement", id: "details" },
  resource,
});
const nestedTargets = [
  ["page", pageTarget],
  ["panel", panelTarget],
  ["parent", (resource: ResourceRef) => ({ ...resolution.target, parent: pageTarget(resource) })],
  [
    "ancestor",
    (resource: ResourceRef) => ({
      ...resolution.target,
      parent: { ...resolution.target, parent: pageTarget(resource) },
    }),
  ],
  ["compound page", (resource: ResourceRef) => ({ kind: "compound", targets: [pageTarget(resource)] })],
  [
    "compound panel",
    (resource: ResourceRef) => ({ kind: "compound", targets: [resolution.target, panelTarget(resource)] }),
  ],
  [
    "compound parent",
    (resource: ResourceRef) => ({
      kind: "compound",
      targets: [{ ...resolution.target, parent: pageTarget(resource) }],
    }),
  ],
] as const;

for (const [name, target] of nestedTargets) {
  test.each(["extensionId", "projectId"])(`rejects a foreign %s in the ${name} destination`, async (field) => {
    await expect(
      resolveResourcePath({
        projectId: "project",
        workspaceId: "workspace",
        path: "tickets/T-1/ticket.md",
        kinds: [kind],
        documentKey,
        execute: async () => ({ ...resolution, target: target({ type: "document", id: "doc", [field]: "foreign" }) }),
      }),
    ).rejects.toThrow("owner or project");
  });
}

test("qualifies local resources throughout a compound destination and its ancestors", async () => {
  const result = await resolveResourcePath({
    projectId: "project",
    workspaceId: "workspace",
    path: "tickets/T-1/ticket.md",
    kinds: [kind],
    documentKey,
    execute: async () => ({
      ...resolution,
      target: {
        kind: "compound",
        targets: [{ ...resolution.target, parent: resolution.target }, panelTarget({ type: "document", id: "doc" })],
      },
    }),
  });
  expect(result?.target).toMatchObject({
    targets: [
      { resource: { extensionId, projectId: "project" }, parent: { resource: { extensionId, projectId: "project" } } },
      { resource: { extensionId, projectId: "project" } },
    ],
  });
});

test("source positions replace a page section and preserve its parent destination", async () => {
  const section = { anchors: ["details"] };
  const result = await resolveResourcePath({
    projectId: "project",
    workspaceId: "workspace",
    path: "tickets/T-1/ticket.md",
    kinds: [kind],
    documentKey,
    position: { line: 12, column: 4 },
    execute: async () => ({
      ...resolution,
      target: { ...resolution.target, resource: savedDocument, section, parent: { ...resolution.target, section } },
    }),
  });
  expect(result?.target).toMatchObject({ position: { line: 12, column: 4 }, parent: { section } });
  if (result?.target.kind !== "page") throw new Error("Expected a page destination");
  expect(result.target.section).toBeUndefined();
  expect(result.target.parent?.position).toBeUndefined();
  expect(isNavigationTarget(result.target)).toBe(true);
});

test("source positions reach every page in compound destinations while panels stay intact", async () => {
  const panel = panelTarget({ type: "document", id: "doc" });
  const result = await resolveResourcePath({
    projectId: "project",
    workspaceId: "workspace",
    path: "tickets/T-1/ticket.md",
    kinds: [kind],
    documentKey,
    position: { line: 12 },
    execute: async () => ({
      ...resolution,
      target: {
        kind: "compound",
        targets: [
          { ...resolution.target, resource: savedDocument, section: { anchors: ["summary"] } },
          { ...resolution.target, resource: savedDocument, position: { line: 3 } },
          panel,
        ],
      },
    }),
  });
  if (result?.target.kind !== "compound") throw new Error("Expected a compound destination");
  expect(result.target.targets).toMatchObject([{ position: { line: 12 } }, { position: { line: 12 } }, panel]);
  expect(
    result.target.targets.filter((target) => target.kind === "page").every((target) => target.section === undefined),
  ).toBe(true);
  expect(isNavigationTarget(result.target)).toBe(true);
});

test("source positions skip pages that open no document", async () => {
  const section = { anchors: ["summary"] };
  const result = await resolveResourcePath({
    projectId: "project",
    workspaceId: "workspace",
    path: "tickets/T-1/ticket.md",
    kinds: [kind],
    documentKey,
    position: { line: 40 },
    execute: async () => ({ ...resolution, target: { ...resolution.target, section } }),
  });
  if (result?.target.kind !== "page") throw new Error("Expected a page destination");
  expect(result.target.position).toBeUndefined();
  expect(result.target).toMatchObject({ section });
});
