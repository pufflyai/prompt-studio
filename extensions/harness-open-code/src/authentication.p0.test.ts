import { expect, test } from "bun:test";
import { createOpencodeAuthentication } from "./authentication";

const providers = {
  data: [
    { id: "openai", name: "OpenAI", integrationID: "openai" },
    { id: "anthropic", name: "Anthropic", integrationID: "anthropic" },
    { id: "local", name: "Local" },
    { id: "opencode", name: "OpenCode", integrationID: "opencode", activation: "enabled" },
  ],
};
const integrations = {
  data: [
    { id: "opencode", methods: [{ type: "key" }], connections: [] },
    {
      id: "openai",
      methods: [{ type: "oauth", id: "browser", label: "Browser" }],
      connections: [{ type: "credential", id: "cred_one" }],
    },
    {
      id: "anthropic",
      methods: [{ type: "key", label: "API key", form: [{ type: "string", key: "account", title: "Account" }] }],
      connections: [],
    },
  ],
};

test("authentication follows the provider integration, preserves free models, and saves keys only in OpenCode", async () => {
  const saved: unknown[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (req) => {
      const path = new URL(req.url).pathname;
      if (path === "/api/provider") return Response.json(providers);
      if (path === "/api/integration") return Response.json(integrations);
      if (path === "/api/integration/anthropic/connect/key" && req.method === "POST") {
        saved.push(await req.json());
        return new Response(null, { status: 204 });
      }
      return new Response("", { status: 404 });
    },
  });
  try {
    const auth = createOpencodeAuthentication({ fetcher: fetch, withServerUrl: async (fn) => fn(server.url.href) });
    expect((await auth.getAuthentication({ model: "anthropic/sonnet" })).status).toBe("signed_out");
    expect((await auth.getAuthentication({ model: "openai/gpt" })).status).toBe("signed_in");
    expect((await auth.getAuthentication({ model: "local/small" })).status).toBe("not_required");
    expect((await auth.getAuthentication({ model: "opencode/big-pickle" })).status).toBe("not_required");
    const replies = ["workspace", "  private-key\n"];
    await auth.authenticate(
      { action: "login", model: "anthropic/sonnet", provider: "anthropic", method: "key" },
      { signal: new AbortController().signal, emit: async () => {}, request: async () => replies.shift()! },
    );
    expect(saved).toEqual([{ key: "private-key", answer: { account: "workspace" } }]);
  } finally {
    await server.stop(true);
  }
});

test("OAuth completes through a native attempt and logout removes only stored credentials", async () => {
  const requests: string[] = [];
  const auth = createOpencodeAuthentication({
    withServerUrl: (fn) => fn("http://localhost:4096"),
    fetcher: async (input, init) => {
      const path = new URL(String(input)).pathname;
      requests.push(`${init?.method} ${path}`);
      if (path === "/api/provider") return Response.json(providers);
      if (path === "/api/integration") return Response.json(integrations);
      if (path.endsWith("/connect/oauth"))
        return Response.json({ data: { attemptID: "attempt_one", mode: "code", url: "https://example.com/login" } });
      if (path.endsWith("/attempt_one") && init?.method === "GET")
        return Response.json({ data: { status: "complete" } });
      if (path.endsWith("/complete")) expect(JSON.parse(String(init?.body))).toEqual({ code: "private-code" });
      return new Response(null, { status: 204 });
    },
  });
  const events: unknown[] = [];
  const channel = {
    signal: new AbortController().signal,
    emit: async (event: unknown) => {
      events.push(event);
    },
    request: async () => "private-code",
  };
  await auth.authenticate({ action: "login", provider: "openai", method: "browser" }, channel);
  expect(events).toContainEqual(expect.objectContaining({ type: "browser", url: "https://example.com/login" }));
  expect(requests).toContain("POST /api/integration/openai/connect/oauth/attempt_one/complete");
  await auth.authenticate({ action: "logout", provider: "openai" }, channel);
  expect(requests).toContain("DELETE /api/credential/cred_one");
});

test("the native active credential decides readiness before historical credentials", async () => {
  const auth = createOpencodeAuthentication({
    withServerUrl: (fn) => fn("http://localhost:4096"),
    fetcher: async (input) => {
      if (new URL(String(input)).pathname === "/api/provider")
        return Response.json({
          data: [{ id: "openai", name: "OpenAI", integrationID: "openai", activation: "enabled" }],
        });
      return Response.json({
        data: [
          {
            id: "openai",
            methods: [{ type: "key" }],
            connections: [
              { type: "credential", id: "current", status: { status: "needs_auth", message: "Expired" } },
              { type: "credential", id: "old" },
            ],
          },
        ],
      });
    },
  });
  expect((await auth.getAuthentication({ model: "openai/gpt" })).status).toBe("signed_out");
});

test("command sign-in delivers native pending instructions through the private channel", async () => {
  let polls = 0;
  const events: unknown[] = [];
  const auth = createOpencodeAuthentication({
    withServerUrl: (fn) => fn("http://localhost:4096"),
    fetcher: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === "/api/provider") return Response.json(providers);
      if (path === "/api/integration")
        return Response.json({
          data: [
            {
              id: "openai",
              methods: [{ type: "command", id: "device", label: "Device", command: ["provider-login"] }],
              connections: [],
            },
          ],
        });
      if (path.endsWith("/command")) return Response.json({ data: { attemptID: "attempt_device" } });
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return Response.json({
        data:
          ++polls === 1
            ? { status: "pending", message: "Open the provider's device login page." }
            : { status: "complete" },
      });
    },
  });
  await auth.authenticate(
    { action: "login", provider: "openai", method: "device" },
    {
      signal: new AbortController().signal,
      request: async () => "",
      emit: async (event) => {
        events.push(event);
      },
    },
  );
  expect(events).toContainEqual({ type: "message", message: "Open the provider's device login page." });
});
