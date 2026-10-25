import { expect, test } from "bun:test";
import { uploadExtensionCommandFile } from "./api";

test("file preparation retains the runtime selected when the upload starts", async () => {
  const received: { path: string; body: string }[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      received.push({ path: new URL(request.url).pathname, body: await request.text() });
      return Response.json({ id: "file" });
    },
  });
  const runtime = globalThis as { __PSTDIO_CONFIG__?: { apiBaseUrl: string } };
  const original = runtime.__PSTDIO_CONFIG__;
  try {
    runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: `${server.url.origin}/first` };
    const pending = uploadExtensionCommandFile("shared", "same.command", new File(["first-private-file"], "file.txt"));
    runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: `${server.url.origin}/second` };
    await pending;
    expect(received).toEqual([
      { path: "/first/v1/projects/shared/extensions/commands/same.command/files", body: "first-private-file" },
    ]);
  } finally {
    runtime.__PSTDIO_CONFIG__ = original;
    server.stop(true);
  }
});
