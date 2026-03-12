import { describe, expect, it } from "bun:test";

import { createServeApp } from "./serve-app";

describe("serveApp", () => {
  it("closes the app when server startup throws", async () => {
    let closed = false;

    const serveApp = createServeApp({
      createApp: async () => ({
        app: {
          fetch: () => new Response("ok"),
        },
        close: async () => {
          closed = true;
        },
      }),
      injectConfig: (html) => html,
      isCompiledBinary: () => false,
      loadEmbeddedAssets: () => new Map(),
      loadFilesystemAssets: () => new Map([["index.html", new Blob(["<html></html>"])]]),
      resolveMimeType: () => "text/html",
      serve: () => {
        throw new Error("listen EADDRINUSE");
      },
    });

    await expect(serveApp({ port: 19840 })).rejects.toThrow("EADDRINUSE");
    expect(closed).toBe(true);
  });
});
