import { strict as assert } from "node:assert";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "@pstdio/sdk/extensions";

export const linkedResourceCount = 200;
export const linkedResourceOwner = "test.planner-linked-resources";
export const linkedTicketTitle = (number: number) => `Linked resource ticket ${String(number).padStart(3, "0")}`;
export interface LinkedTicket {
  id: string;
  title: string;
  shorthand: string;
  workspaceId: string;
  workspaceLabel: string;
  number: number;
}
export interface LinkedFixture {
  projectId: string;
  tickets: LinkedTicket[];
}

export const linkedResourcesApi = (baseUrl: string, token: string) => {
  const request = async <T>(path: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> => {
    const response = await fetch(`${baseUrl}/v1${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = await response.json();
    assert(response.ok, `${method} ${path}: ${JSON.stringify(result)}`);
    return result as T;
  };
  const execute = async <T>(
    projectId: string,
    owner: string,
    command: string,
    params: Record<string, unknown> = {},
  ) => {
    const result = await request<{ outcome: { ok: boolean; value: T } }>(
      `/projects/${projectId}/extensions/commands/${owner}.command.${command}/execute`,
      { params, source: "api" },
    );
    assert(result.outcome.ok, `${command}: ${JSON.stringify(result)}`);
    return result.outcome.value;
  };
  return { request, execute };
};
type Api = ReturnType<typeof linkedResourcesApi>;

export const installLinkedResourceFixture = async (
  api: Api,
  projectId: string,
  root: string,
  install: (source: string, name: string) => void,
) => {
  const source = join(root, "linked-resource-owner");
  mkdirSync(source, { recursive: true });
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, "planner-linked-resources-extension.fixture.ts")],
    outdir: source,
    naming: "extension.js",
    target: "bun",
  });
  assert(built.success, built.logs.join("\n"));
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "planner-linked-resources",
      publisher: "test",
      version: "1.0.0",
      type: "module",
      main: "./extension.js",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  install(source, "planner-linked-resources");
  const metadata = await api.request<{ resourceKinds: { extensionId: string }[] }>(
    `/projects/${projectId}/extensions/ui`,
  );
  assert.equal(metadata.resourceKinds.filter((kind) => kind.extensionId === linkedResourceOwner).length, 2);
};

export const seedLinkedResources = async (api: Api, projectId: string) => {
  const planner = <T>(command: string, params: Record<string, unknown> = {}) =>
    api.execute<T>(projectId, "pstdio.planner", command, params);
  const existing = await planner<LinkedTicket[]>("read-tickets");
  assert.equal(existing.length, 0, "Seed only a fresh isolated project; never add this workload to a working board");
  const statuses = await planner<{ statuses: { id: string }[] }>("ticket-status.read");
  const tickets: LinkedTicket[] = [];
  for (let number = 1; number <= linkedResourceCount; number++) {
    const ticket = await planner<LinkedTicket>("create-ticket", {
      content: `# ${linkedTicketTitle(number)}\n\n${"Synthetic implementation instructions. ".repeat(128)}`,
      statusId: statuses.statuses[(number - 1) % 4]!.id,
    });
    const workspace = await api.request<{ id: string; name: string; workspace_shorthand: string }>("/workspaces", {
      project_id: projectId,
      provider_id: "pstdio.worktree",
      params: { base: "HEAD" },
      anchors: [{ type: "ticket", extensionId: "pstdio.planner", id: ticket.id, label: ticket.shorthand }],
    });
    await api.execute(projectId, linkedResourceOwner, "link", { ticket: ticket.id, number: String(number) });
    tickets.push({
      id: ticket.id,
      title: ticket.title,
      shorthand: ticket.shorthand,
      number,
      workspaceId: workspace.id,
      workspaceLabel: workspace.name || workspace.workspace_shorthand,
    });
    if (number % 25 === 0)
      console.info(`Seeded ${number}/${linkedResourceCount} tickets with workspaces, PRs and builds`);
  }
  const path = `/projects/${projectId}/boards/pstdio.planner.view.tickets`;
  const view = await api.request<{ id: string }>(`${path}/views`, {
    title: "200 linked tickets",
    settings: {
      viewMode: "board",
      rowGrouping: "none",
      columnGrouping: "status",
      displayProperties: ["id", "workspace"],
    },
    filter: { conjunction: "and", rules: [] },
    sorts: [{ attributeId: "created", direction: "asc" }],
  });
  await api.request(`${path}/views/default`, { viewId: view.id }, "PUT");
  return { projectId, tickets } satisfies LinkedFixture;
};
