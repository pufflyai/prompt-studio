import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type {
  AgentConfig,
  AgentInfo,
  Project,
  Skill,
  Status,
  Tag,
  Template,
  Ticket,
  TicketDetail,
  TicketListItem,
} from "@pstdio/sdk/resources";
import { createApp } from "../../app";
import type { AppBindings } from "../../types";

let app: OpenAPIHono<AppBindings>;
let close: () => Promise<void>;
let tempRoot: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-sdk-resource-test-"));
  ({ app, close } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  }));
});

afterAll(async () => {
  await close();
  rmSync(tempRoot, { recursive: true, force: true });
});

const json = async <T>(path: string): Promise<T> => {
  const res = await app.request(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json() as Promise<T>;
};

const PROJECT_KEYS: (keyof Project)[] = [
  "id",
  "name",
  "shorthand",
  "startup_script",
  "created_at",
  "updated_at",
  "deleted_at",
];

const TICKET_KEYS: (keyof Ticket)[] = [
  "id",
  "shorthand",
  "project_id",
  "status_id",
  "display_title",
  "user_prompt",
  "file_id",
  "parent_id",
  "parallelizable",
  "blocked_reason",
  "depends_on",
  "draft",
  "archived",
  "deleted_at",
  "created_at",
  "updated_at",
];

const TICKET_LIST_ITEM_EXTRA_KEYS: (keyof TicketListItem)[] = ["status_name", "tag_ids", "tag_names"];

const TICKET_DETAIL_EXTRA_KEYS: (keyof TicketDetail)[] = ["content"];

const STATUS_KEYS: (keyof Status)[] = [
  "id",
  "project_id",
  "name",
  "color",
  "sort_order",
  "is_default",
  "can_create",
  "can_drag_in",
  "can_drag_out",
  "column_actions",
  "created_at",
  "updated_at",
  "deleted_at",
];

const TAG_KEYS: (keyof Tag)[] = [
  "id",
  "project_id",
  "name",
  "type",
  "options",
  "created_at",
  "updated_at",
  "deleted_at",
];

const TEMPLATE_KEYS: (keyof Template)[] = [
  "id",
  "project_id",
  "name",
  "template_type",
  "file_id",
  "is_default",
  "created_at",
  "updated_at",
  "deleted_at",
];

const SKILL_KEYS: (keyof Skill)[] = [
  "id",
  "project_id",
  "name",
  "description",
  "file_id",
  "created_at",
  "updated_at",
  "deleted_at",
];

const AGENT_CONFIG_KEYS: (keyof AgentConfig)[] = ["id", "agent_id", "is_default", "config", "created_at", "updated_at"];

const AGENT_INFO_KEYS: (keyof AgentInfo)[] = ["id", "name", "availability"];

const hasAllKeys = (obj: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    expect(obj).toHaveProperty(key);
  }
};

const hasNoExtraKeys = (obj: Record<string, unknown>, keys: string[]) => {
  const allowed = new Set(keys);
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      throw new Error(
        `Unexpected field "${key}" in response (not declared in SDK type). Value: ${JSON.stringify(obj[key])}`,
      );
    }
  }
};

const matchesShape = (obj: Record<string, unknown>, keys: string[]) => {
  hasAllKeys(obj, keys);
  hasNoExtraKeys(obj, keys);
};

describe("SDK resource types match API responses", () => {
  let projectId: string;

  it("Project matches GET /v1/projects", async () => {
    const res = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Resource Test" }),
    });
    const project = (await res.json()) as Project;
    projectId = project.id;

    const projects = await json<Project[]>("/v1/projects");
    expect(projects.length).toBeGreaterThan(0);
    matchesShape(projects[0]! as unknown as Record<string, unknown>, PROJECT_KEYS);
  });

  it("TicketListItem matches GET /v1/tickets", async () => {
    await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, user_prompt: "resource test ticket" }),
    });
    const tickets = await json<TicketListItem[]>(`/v1/tickets?project_id=${projectId}`);
    expect(tickets.length).toBeGreaterThan(0);
    matchesShape(tickets[0]! as unknown as Record<string, unknown>, [...TICKET_KEYS, ...TICKET_LIST_ITEM_EXTRA_KEYS]);
  });

  it("TicketDetail matches GET /v1/tickets/:id", async () => {
    const tickets = await json<TicketListItem[]>(`/v1/tickets?project_id=${projectId}`);
    const detail = await json<TicketDetail>(`/v1/tickets/${tickets[0]!.id}`);
    matchesShape(detail as unknown as Record<string, unknown>, [...TICKET_KEYS, ...TICKET_DETAIL_EXTRA_KEYS]);
  });

  it("Status matches GET /v1/projects/:id/statuses", async () => {
    const statuses = await json<Status[]>(`/v1/projects/${projectId}/statuses`);
    if (statuses.length === 0) return;
    matchesShape(statuses[0]! as unknown as Record<string, unknown>, STATUS_KEYS);
  });

  it("Tag matches GET /v1/projects/:id/ticket-tags", async () => {
    const tags = await json<Tag[]>(`/v1/projects/${projectId}/ticket-tags`);
    if (tags.length === 0) return;
    matchesShape(tags[0]! as unknown as Record<string, unknown>, TAG_KEYS);
  });

  it("Template matches GET /v1/projects/:id/templates", async () => {
    const templates = await json<Template[]>(`/v1/projects/${projectId}/templates`);
    if (templates.length === 0) return;
    matchesShape(templates[0]! as unknown as Record<string, unknown>, TEMPLATE_KEYS);
  });

  it("Skill matches GET /v1/projects/:id/skills", async () => {
    const skills = await json<Skill[]>(`/v1/projects/${projectId}/skills`);
    if (skills.length === 0) return;
    matchesShape(skills[0]! as unknown as Record<string, unknown>, SKILL_KEYS);
  });

  it("AgentConfig matches GET /v1/agents", async () => {
    await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "fake" }),
    });
    const agents = await json<AgentConfig[]>("/v1/agents");
    expect(agents.length).toBeGreaterThan(0);
    matchesShape(agents[0]! as unknown as Record<string, unknown>, AGENT_CONFIG_KEYS);
  });

  it("AgentInfo matches GET /v1/agents/info", async () => {
    const info = await json<AgentInfo[]>("/v1/agents/info");
    expect(info.length).toBeGreaterThan(0);
    matchesShape(info[0]! as unknown as Record<string, unknown>, AGENT_INFO_KEYS);
  });
});
