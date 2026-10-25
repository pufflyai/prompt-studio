import { expect, test } from "bun:test";
import { createClient } from "./client";

test("discovers host drives and browses a selected drive through the public client", async () => {
  const drives = [
    { name: "C:", path: "C:\\" },
    { name: "D:", path: "D:\\" },
  ];
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      expect(request.headers.get("authorization")).toBe("Bearer owner");
      const url = new URL(request.url);
      if (url.pathname === "/v1/filesystem/drives") return Response.json({ drives });
      expect(url.pathname).toBe("/v1/filesystem/list");
      expect(url.searchParams.get("path")).toBe("D:\\My tools");
      return Response.json({ currentPath: "D:\\My tools", entries: [] });
    },
  });
  try {
    const client = createClient({ baseUrl: server.url.origin, token: "owner" });
    expect(await client.filesystem.drives()).toEqual({ drives });
    expect(await client.filesystem.list("D:\\My tools")).toEqual({ currentPath: "D:\\My tools", entries: [] });
  } finally {
    server.stop(true);
  }
});
