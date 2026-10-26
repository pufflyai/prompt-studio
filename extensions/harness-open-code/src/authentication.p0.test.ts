import { expect, test } from "bun:test";
import { createOpencodeAuthentication } from "./authentication";

test("authentication follows the model provider, preserves free models, and saves keys only in OpenCode", async () => {
  const saved: unknown[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (req) => {
      const path = new URL(req.url).pathname;
      if (path === "/provider")
        return Response.json({
          all: [
            { id: "openai", name: "OpenAI", source: "api", models: { gpt: {} } },
            { id: "anthropic", name: "Anthropic", source: "custom", models: {} },
            { id: "local", name: "Local", source: "custom", models: { small: {} } },
          ],
          connected: ["openai", "local"],
        });
      if (path === "/provider/auth")
        return Response.json({
          anthropic: [{ type: "api", label: "Key", prompts: [{ type: "text", key: "account", message: "Account" }] }],
        });
      if (path === "/auth/anthropic" && req.method === "PUT") {
        expect(req.headers.get("content-type")).toBe("application/json");
        saved.push(await req.json());
        return Response.json(true);
      }
      return new Response("", { status: 404 });
    },
  });
  try {
    const auth = createOpencodeAuthentication({
      fetcher: fetch,
      storedProviders: async () => ["openai"],
      withServerUrl: async (fn) => fn(server.url.href),
    });
    expect((await auth.getAuthentication({ model: "anthropic/sonnet" })).status).toBe("signed_out");
    expect((await auth.getAuthentication({ model: "openai/gpt" })).status).toBe("signed_in");
    expect((await auth.getAuthentication({ model: "local/small" })).status).toBe("not_required");
    const replies = ["anthropic", "0", "workspace", "  private-key\n"];
    await auth.authenticate(
      { action: "login", model: "anthropic/sonnet" },
      { signal: new AbortController().signal, emit: async () => {}, request: async () => replies.shift()! },
    );
    expect(saved).toEqual([{ type: "api", key: "private-key", metadata: { account: "workspace" } }]);
  } finally {
    server.stop(true);
  }
});
