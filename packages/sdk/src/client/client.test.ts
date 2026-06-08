import { describe, expect, it } from "bun:test";
import { createClient } from "./client";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const trackingFetch = () => {
  const calls: { url: string; method: string; body?: string }[] = [];
  const fetchFn = ((url: string, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? "GET",
      body: init?.body as string | undefined,
    });
    return Promise.resolve(jsonResponse([]));
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
};

describe("createClient", () => {
  it("creates a client with all domain groups", () => {
    const client = createClient({ baseUrl: "http://test:1234", fetch: (() => {}) as unknown as typeof fetch });

    expect(client.projects).toBeDefined();
    expect(client.workspaces).toBeDefined();
    expect(client.sessions).toBeDefined();
    expect(client.templates).toBeDefined();
    expect(client.skills).toBeDefined();
    expect(client.agents).toBeDefined();
    expect("actions" in client).toBe(false);
    expect(client.extensions).toBeDefined();
    expect(client.settings).toBeDefined();
    expect(client.sync).toBeDefined();
  });

  it("client.projects.list calls GET /v1/projects", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.projects.list();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/projects");
    expect(calls[0]!.method).toBe("GET");
  });

  it("client.sessions.list calls GET /v1/sessions?project_id=:id", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.sessions.list("proj-1");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/sessions?project_id=proj-1");
  });

  it("client.sessions.list encodes supported filters", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.sessions.list("proj-1", { status: "queued", agent: "opencode", archived: true });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(
      "http://test:1234/v1/sessions?project_id=proj-1&status=queued&agent=opencode&archived=true",
    );
  });

  it("client.settings.get calls GET /v1/settings", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.settings.get();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/settings");
    expect(calls[0]!.method).toBe("GET");
  });

  it("client.settings.update calls PATCH /v1/settings", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.settings.update({ max_concurrent_sessions: 3 });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/settings");
    expect(calls[0]!.method).toBe("PATCH");
    expect(JSON.parse(calls[0]!.body!)).toEqual({ max_concurrent_sessions: 3 });
  });

  it("client.workspaces.list calls GET /v1/workspaces?project_id=:id", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.workspaces.list("proj-1");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/workspaces?project_id=proj-1");
  });

  it("client.workspaces.rename calls PATCH /v1/workspaces/:id", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.workspaces.rename("ws-1", { name: "Spike - API only" });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/workspaces/ws-1");
    expect(calls[0]!.method).toBe("PATCH");
    expect(JSON.parse(calls[0]!.body!)).toEqual({ name: "Spike - API only" });
  });

  it("client.workspaces.removeWorktree calls POST /v1/workspaces/:id/remove-worktree", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.workspaces.removeWorktree("ws-1");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/workspaces/ws-1/remove-worktree");
    expect(calls[0]!.method).toBe("POST");
  });

  it("client.templates.update calls PUT /v1/projects/:id/templates/:name", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.templates.update("proj-1", "adr", { content: "# Updated", is_default: true });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/projects/proj-1/templates/adr");
    expect(calls[0]!.method).toBe("PUT");
    expect(JSON.parse(calls[0]!.body!)).toEqual({ content: "# Updated", is_default: true });
  });

  it("client.extensions.updateInstalledTemplate calls PUT /v1/extensions/installed/:name/templates/:key", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.extensions.updateInstalledTemplate("catalog", "catalogTicket", { content: "# Updated" });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/extensions/installed/catalog/templates/catalogTicket");
    expect(calls[0]!.method).toBe("PUT");
    expect(JSON.parse(calls[0]!.body!)).toEqual({ content: "# Updated" });
  });

  it("client.skills.updatePreferences calls PUT /v1/projects/:id/skills/:name", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.skills.updatePreferences("proj-1", "triage", { enabled: false });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/projects/proj-1/skills/triage");
    expect(calls[0]!.method).toBe("PUT");
    expect(JSON.parse(calls[0]!.body!)).toEqual({ enabled: false });
  });
});
