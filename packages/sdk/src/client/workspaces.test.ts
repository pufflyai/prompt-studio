import { describe, expect, test } from "bun:test";
import type { CreateWorkspaceInput } from "../api/workspaces";
import type { RequestFn } from "./request";
import { createWorkspaceClient } from "./workspaces";

test("creates a provider workspace with its resource anchors and shorthand prefix", async () => {
  const calls: Array<{ path: string; options?: unknown }> = [];
  const client = createWorkspaceClient(((path, options) => {
    calls.push({ path, options });
    return Promise.resolve({ id: "cloud-workspace" });
  }) as RequestFn);
  const input = {
    project_id: "project-1",
    provider_id: "example.cloud",
    params: { image: "documents" },
    anchors: [{ type: "document", id: "doc-7" }],
  } satisfies CreateWorkspaceInput;

  await client.create(input);

  expect(calls).toEqual([{ path: "/v1/workspaces", options: { method: "POST", body: input } }]);
});

describe("workspace file client", () => {
  test("lists files with encoded browse and search inputs", async () => {
    const calls: Array<{ path: string; options?: unknown }> = [];
    const request = ((path, options) => {
      calls.push({ path, options });
      return Promise.resolve({ entries: [] });
    }) as RequestFn;
    const client = createWorkspaceClient(request);

    await client.listFiles("workspace 1", { path: "src files", query: "button/icon", limit: 25 });

    expect(calls).toEqual([
      {
        path: "/v1/workspaces/workspace%201/files?path=src+files&query=button%2Ficon&limit=25",
        options: undefined,
      },
    ]);
  });

  test("creates directories and creates, reads, writes, moves, and deletes one encoded workspace path", async () => {
    const calls: Array<{ path: string; options?: unknown }> = [];
    const request = ((path, options) => {
      calls.push({ path, options });
      return Promise.resolve({ path: "docs/read me.md" });
    }) as RequestFn;
    const client = createWorkspaceClient(request);

    await client.createDirectory("workspace 1", "docs/new folder");
    await client.createFile("workspace 1", "docs/read me.md", { content: "" });
    await client.readFile("workspace 1", "docs/read me.md");
    await client.writeFile("workspace 1", "docs/read me.md", { content: "updated" });
    await client.moveEntry("workspace 1", "docs/read me.md", "archive/read me.md");
    await client.deleteEntry("workspace 1", "docs/read me.md");

    expect(calls).toEqual([
      {
        path: "/v1/workspaces/workspace%201/directory?path=docs%2Fnew+folder",
        options: { method: "POST" },
      },
      {
        path: "/v1/workspaces/workspace%201/file?path=docs%2Fread+me.md",
        options: { method: "POST", body: { content: "" } },
      },
      {
        path: "/v1/workspaces/workspace%201/file?path=docs%2Fread+me.md",
        options: undefined,
      },
      {
        path: "/v1/workspaces/workspace%201/file?path=docs%2Fread+me.md",
        options: { method: "PUT", body: { content: "updated" } },
      },
      {
        path: "/v1/workspaces/workspace%201/entry?path=docs%2Fread+me.md",
        options: { method: "PATCH", body: { destination_path: "archive/read me.md" } },
      },
      {
        path: "/v1/workspaces/workspace%201/entry?path=docs%2Fread+me.md",
        options: { method: "DELETE" },
      },
    ]);
  });
});
