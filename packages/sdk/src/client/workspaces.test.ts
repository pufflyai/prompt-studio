import { describe, expect, test } from "bun:test";
import type { RequestFn } from "./request";
import { createWorkspaceClient } from "./workspaces";

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

  test("creates, reads, writes, reveals, and deletes one encoded file path", async () => {
    const calls: Array<{ path: string; options?: unknown }> = [];
    const request = ((path, options) => {
      calls.push({ path, options });
      return Promise.resolve({ path: "docs/read me.md" });
    }) as RequestFn;
    const client = createWorkspaceClient(request);

    await client.createFile("workspace 1", "docs/read me.md", { content: "" });
    await client.readFile("workspace 1", "docs/read me.md");
    await client.writeFile("workspace 1", "docs/read me.md", { content: "updated" });
    await client.revealFile("workspace 1", "docs/read me.md");
    await client.deleteFile("workspace 1", "docs/read me.md");

    expect(calls).toEqual([
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
        path: "/v1/workspaces/workspace%201/reveal?path=docs%2Fread+me.md",
        options: { method: "POST" },
      },
      {
        path: "/v1/workspaces/workspace%201/file?path=docs%2Fread+me.md",
        options: { method: "DELETE" },
      },
    ]);
  });
});
