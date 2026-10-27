import { expect, test } from "bun:test";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { authenticateOpencode } from "./account-action";

test("cancelling OpenCode sign-in releases its own server without touching the session server", async () => {
  let disposed = false;
  const ready = Promise.withResolvers<void>();
  const controller = new AbortController();
  const server = Bun.serve({ port: 0, fetch: () => Response.json({}) });
  const operation = authenticateOpencode(
    { net: { findFreePort: async () => server.port } } as HarnessContext,
    { action: "login", provider: "openai", method: "0" },
    {
      signal: controller.signal,
      emit: async () => {},
      request: () => {
        ready.resolve();
        return new Promise((_resolve, reject) =>
          controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true }),
        );
      },
    },
    {
      startServer: async () => ({
        url: server.url.href,
        dispose: async () => {
          disposed = true;
          server.stop(true);
        },
      }),
      fetcher: async (input) =>
        new URL(String(input)).pathname === "/provider"
          ? Response.json({ all: [{ id: "openai", name: "OpenAI", source: "custom", models: {} }], connected: [] })
          : Response.json({ openai: [{ type: "api", label: "API key" }] }),
    },
  );
  const result = operation.catch((error) => error);
  await ready.promise;
  controller.abort();
  expect(await result).toMatchObject({ name: "AbortError" });
  expect(disposed).toBe(true);
});
