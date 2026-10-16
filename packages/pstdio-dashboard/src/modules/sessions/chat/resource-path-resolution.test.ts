import { expect, test } from "bun:test";
import { resolveResourcePath } from "./resource-path-resolution";

const extensionId = "acme.planner";
const kind = {
  id: "ticket",
  extensionId,
  icon: "component",
  paths: [{ prefix: "tickets/", resolveCommand: "acme.planner.command.open-path" }],
};
const resolution = {
  resource: { type: "ticket", id: "t1", label: "T-1 Fix links" },
  target: { kind: "page", page: { kind: "page", id: "ticket" }, resource: { type: "ticket", id: "t1" } },
};

test("a claimed path resolves to its owner's resource and qualified destination", async () => {
  const calls: unknown[] = [];
  const result = await resolveResourcePath({
    projectId: "project",
    workspaceId: "workspace",
    path: "tickets/T-1/ticket.md",
    kinds: [kind],
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
  const input = { projectId: "project", workspaceId: "workspace", path: "tickets/T-1/ticket.md", kinds: [kind] };
  expect(await resolveResourcePath({ ...input, execute: async () => null })).toBeNull();
  await expect(
    resolveResourcePath({
      ...input,
      execute: async () => ({ ...resolution, resource: { ...resolution.resource, extensionId: "other" } }),
    }),
  ).rejects.toThrow("owner");
});
