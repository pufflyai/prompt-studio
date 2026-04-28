import { describe, expect, it } from "bun:test";
import { createClient } from "./client";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const trackingFetch = () => {
  const calls: { url: string; method: string; body?: string }[] = [];
  const fetchFn = ((url: string, init?: RequestInit) => {
    const urlString = String(url);
    calls.push({
      url: urlString,
      method: init?.method ?? "GET",
      body: init?.body as string | undefined,
    });
    return Promise.resolve(
      jsonResponse(urlString.includes("/extensions/pstdio.planner/collections/") ? { items: [] } : []),
    );
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
};

describe("createClient", () => {
  it("creates a client with all domain groups", () => {
    const client = createClient({ baseUrl: "http://test:1234", fetch: (() => {}) as unknown as typeof fetch });

    expect(client.projects).toBeDefined();
    expect(client.tickets).toBeDefined();
    expect(client.workspaces).toBeDefined();
    expect(client.sessions).toBeDefined();
    expect(client.statuses).toBeDefined();
    expect(client.tags).toBeDefined();
    expect(client.templates).toBeDefined();
    expect(client.skills).toBeDefined();
    expect(client.harnesses).toBeDefined();
    expect(client.actions).toBeDefined();
    expect(client.extensionCommands).toBeDefined();
    expect("agents" in client).toBe(false);
    expect("planner" in client).toBe(false);
  });

  it("client.projects.list calls GET /v1/projects", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.projects.list();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/projects");
    expect(calls[0]!.method).toBe("GET");
  });

  it("client.tickets.list calls planner ticket collection", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.tickets.list("proj-1");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/projects/proj-1/extensions/pstdio.planner/collections/tickets");
  });

  it("client.tickets.create executes planner createTicket", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.tickets.create({ project_id: "proj-1", content: "hello" });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(
      "http://test:1234/v1/projects/proj-1/extension-commands/pstdio.planner.createTicket/execute",
    );
    expect(calls[0]!.method).toBe("POST");
    expect(JSON.parse(calls[0]!.body!)).toEqual({
      params: {
        content: "hello",
        draft: false,
        parent_id: null,
        status_id: null,
        tag_ids: undefined,
        user_prompt: null,
      },
    });
  });

  it("client.tickets.updateWhenAttemptStatus requires planner project context", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await expect(
      client.tickets.updateWhenAttemptStatus("ticket-1", {
        all_attempts_status: "reviewed",
        set_status: "review",
      }),
    ).rejects.toThrow("client.tickets.updateWhenAttemptStatus requires planner/generic APIs");

    expect(calls).toHaveLength(0);
  });

  it("client.sessions.list calls GET /v1/sessions?project_id=:id", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.sessions.list("proj-1");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/sessions?project_id=proj-1");
  });

  it("client.workspaces.list calls GET /v1/workspaces?project_id=:id", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.workspaces.list("proj-1");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/workspaces?project_id=proj-1");
  });

  it("client.workspaces.updateAttemptStatus calls PATCH /v1/workspaces/:id/attempt-status", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.workspaces.updateAttemptStatus("ws-1", { status: "wip", session_id: "sess-1" });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/workspaces/ws-1/attempt-status");
    expect(calls[0]!.method).toBe("PATCH");
    expect(JSON.parse(calls[0]!.body!)).toEqual({ status: "wip", session_id: "sess-1" });
  });

  it("client.workspaces.removeWorktree calls POST /v1/workspaces/:id/remove-worktree", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.workspaces.removeWorktree("ws-1");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/workspaces/ws-1/remove-worktree");
    expect(calls[0]!.method).toBe("POST");
  });

  it("client.statuses.list calls planner status collection", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.statuses.list("proj-1");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/projects/proj-1/extensions/pstdio.planner/collections/statuses");
  });

  it("client.projects.listPlugins calls GET /v1/projects/:id/plugins", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.projects.listPlugins("proj-1");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/projects/proj-1/plugins");
    expect(calls[0]!.method).toBe("GET");
  });

  it("client.projects.registerPlugins calls POST /v1/projects/:id/plugins/register", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.projects.registerPlugins("proj-1");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/projects/proj-1/plugins/register");
    expect(calls[0]!.method).toBe("POST");
  });

  it("client.tags.list calls planner tag collections", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.tags.list("proj-1");

    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.url)).toEqual([
      "http://test:1234/v1/projects/proj-1/extensions/pstdio.planner/collections/tags",
      "http://test:1234/v1/projects/proj-1/extensions/pstdio.planner/collections/tag_options",
    ]);
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

  it("client.extensionCommands.execute calls POST /v1/projects/:id/extension-commands/:commandId/execute", async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    const fetchFn = ((url: string, init?: RequestInit) => {
      calls.push({
        url: String(url),
        method: init?.method ?? "GET",
        body: init?.body as string | undefined,
      });
      return Promise.resolve(jsonResponse({ result: { ok: true } }));
    }) as unknown as typeof fetch;
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await expect(
      client.extensionCommands.execute("proj-1", "project.extension-lab.inspect", { params: { id: 1 } }),
    ).resolves.toEqual({ ok: true });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(
      "http://test:1234/v1/projects/proj-1/extension-commands/project.extension-lab.inspect/execute",
    );
    expect(calls[0]!.method).toBe("POST");
    expect(JSON.parse(calls[0]!.body!)).toEqual({ params: { id: 1 } });
  });

  it("client.harnesses.models calls GET /v1/harnesses/:id/models", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.harnesses.models("pstdio.harness.opencode");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/harnesses/pstdio.harness.opencode/models");
    expect(calls[0]!.method).toBe("GET");
  });

  it("client.harnesses.setupAvailable calls POST /v1/harnesses/setup-available", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.harnesses.setupAvailable({ default_harness_id: "pstdio.harness.opencode" });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/harnesses/setup-available");
    expect(calls[0]!.method).toBe("POST");
    expect(JSON.parse(calls[0]!.body!)).toEqual({ default_harness_id: "pstdio.harness.opencode" });
  });
});

describe("registry clients", () => {
  it("client.templates.list can filter by type", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.templates.list("proj-1", { type: "ticket" });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://test:1234/v1/projects/proj-1/templates?type=ticket");
  });

  it("client.templates.copy and default preferences use registry endpoints", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.templates.copy("proj-1", "extension.template", { name: "template-copy" });
    await client.templates.disable("proj-1", "extension.template");
    await client.templates.enable("proj-1", "extension.template");

    expect(calls).toHaveLength(3);
    expect(calls[0]!.url).toBe("http://test:1234/v1/projects/proj-1/templates/extension.template/copy");
    expect(calls[0]!.method).toBe("POST");
    expect(JSON.parse(calls[0]!.body!)).toEqual({ name: "template-copy" });
    expect(calls[1]!.url).toBe("http://test:1234/v1/projects/proj-1/templates/extension.template/disable");
    expect(calls[1]!.method).toBe("POST");
    expect(calls[2]!.url).toBe("http://test:1234/v1/projects/proj-1/templates/extension.template/enable");
    expect(calls[2]!.method).toBe("POST");
  });

  it("client.skills.edit and default preferences use registry endpoints", async () => {
    const { fetchFn, calls } = trackingFetch();
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.skills.edit("proj-1", "project.extension.skill", {
      description: "Edited",
      files: [{ path: "SKILL.md", content: "# Edited", encoding: "utf8" }],
    });
    await client.skills.copy("proj-1", "project.extension.skill");
    await client.skills.disable("proj-1", "project.extension.skill");
    await client.skills.enable("proj-1", "project.extension.skill");

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "PUT http://test:1234/v1/projects/proj-1/skills/project.extension.skill",
      "POST http://test:1234/v1/projects/proj-1/skills/project.extension.skill/copy",
      "POST http://test:1234/v1/projects/proj-1/skills/project.extension.skill/disable",
      "POST http://test:1234/v1/projects/proj-1/skills/project.extension.skill/enable",
    ]);
    expect(JSON.parse(calls[1]!.body!)).toEqual({});
  });
});
