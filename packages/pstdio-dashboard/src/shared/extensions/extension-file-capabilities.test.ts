import { describe, expect, test } from "bun:test";
import { createExtensionFileCapabilities } from "./extension-file-capabilities";

describe("createExtensionFileCapabilities", () => {
  test("uploads binary data with trusted project and extension owners", async () => {
    const calls: Array<{ options?: { body?: unknown; headers?: HeadersInit; method?: string }; path: string }> = [];
    const capabilities = createExtensionFileCapabilities({
      extensionInstanceId: "instance/1",
      projectId: "project/1",
      request: async (path, options) => {
        calls.push({ path, options });
        return { id: "file-1" } as never;
      },
    });
    const data = Uint8Array.from([1, 2, 3]);

    await capabilities.upload({ name: "data set.csv", data, mimeType: "text/csv" });

    expect(calls).toEqual([
      {
        path: "/v1/projects/project%2F1/extensions/instance%2F1/files",
        options: {
          method: "POST",
          body: data,
          headers: { "content-type": "text/csv", "x-file-name": "data%20set.csv" },
        },
      },
    ]);
  });

  test("maps explicit scopes for upload and list", async () => {
    const paths: string[] = [];
    const capabilities = createExtensionFileCapabilities({
      extensionInstanceId: "instance-1",
      projectId: "project-1",
      request: async (path) => {
        paths.push(path);
        return { files: [] } as never;
      },
    });

    await capabilities.upload({
      name: "note.txt",
      data: new ArrayBuffer(0),
      scope: { type: "resource", id: "ticket/1" },
    });
    await capabilities.list({ scope: { type: "repo", id: "repo/1" } });
    await capabilities.list({});

    expect(paths).toEqual([
      "/v1/projects/project-1/extensions/instance-1/files?scope_type=resource&scope_id=ticket%2F1",
      "/v1/projects/project-1/extensions/instance-1/files?scope_type=repo&scope_id=repo%2F1",
      "/v1/projects/project-1/extensions/instance-1/files",
    ]);
  });

  test("returns the list envelope and encodes delete ids", async () => {
    const calls: Array<{ method?: string; path: string }> = [];
    const files = [
      {
        id: "file-1",
        name: "file.txt",
        mimeType: "text/plain",
        size: 4,
        hash: "hash-1",
        url: "/files/file-1/content",
        createdAt: "2026-08-29T00:00:00.000Z",
        updatedAt: "2026-08-29T00:00:00.000Z",
      },
    ];
    const capabilities = createExtensionFileCapabilities({
      extensionInstanceId: "instance-1",
      projectId: "project-1",
      request: async (path, options) => {
        calls.push({ path, method: options?.method });
        return (options?.method === "DELETE" ? undefined : { files }) as never;
      },
    });

    await expect(capabilities.list({})).resolves.toEqual({ files });
    await expect(capabilities.delete({ id: "file/1" })).resolves.toBeUndefined();
    expect(calls).toEqual([
      { path: "/v1/projects/project-1/extensions/instance-1/files", method: undefined },
      { path: "/v1/projects/project-1/extensions/instance-1/files/file%2F1", method: "DELETE" },
    ]);
  });
});
