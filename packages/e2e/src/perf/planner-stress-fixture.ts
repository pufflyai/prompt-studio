import { strict as assert } from "node:assert";
import type { APIRequestContext } from "@playwright/test";

export const plannerBoardId = "pstdio.pstdio-planner.view.tickets";
export const ticketTitle = (index: number) => `Stress ticket ${String(index + 1).padStart(4, "0")}`;

export interface StressTicket {
  id: string;
  title: string;
  statusId: string;
  sortOrder: number;
}

export const executePlanner = async <T>(
  api: APIRequestContext,
  projectId: string,
  command: string,
  params: Record<string, unknown>,
) => {
  const start = performance.now();
  const response = await api.post(
    `/v1/projects/${projectId}/extensions/commands/pstdio.pstdio-planner.command.${command}/execute`,
    { data: { params } },
  );
  const body = await response.json();
  assert(response.ok(), JSON.stringify(body));
  assert(body.outcome.ok, JSON.stringify(body));
  return {
    value: body.outcome.value as T,
    ms: performance.now() - start,
    bytes: Buffer.byteLength(await response.text()),
  };
};

export const seedStressTickets = async (
  api: APIRequestContext,
  projectId: string,
  tickets: StressTicket[],
  count: number,
  statusIds: { backlog: string; ready: string },
) => {
  while (tickets.length < count) {
    const index = tickets.length;
    const { value } = await executePlanner<StressTicket>(api, projectId, "create-ticket", {
      content: `# ${ticketTitle(index)}\n\n${"Synthetic ticket instructions.\n".repeat(128)}`,
      statusId: index < 10 || index % 2 === 0 ? statusIds.backlog : statusIds.ready,
      tagIds: ["default-type-bug", index % 3 === 0 ? "default-priority-high" : "default-priority-medium"],
    });
    tickets.push(value);
    if (tickets.length % 100 === 0) console.info(`Seeded ${tickets.length} tickets`);
  }
};

interface SavedView {
  id: string;
  title: string;
  settings: Record<string, unknown>;
  filter: unknown;
}

export const configureStressViews = async (
  api: APIRequestContext,
  projectId: string,
  count: number,
  sorted: boolean,
) => {
  const path = `/v1/projects/${projectId}/boards/${plannerBoardId}/views`;
  const listed = await api.get(path);
  assert(listed.ok(), await listed.text());
  const { views } = (await listed.json()) as { views: SavedView[] };
  const active = views[0];
  const sorts = sorted ? [{ attributeId: "created", direction: "desc" }] : [];
  const updated = await api.patch(`/v1/projects/${projectId}/board-views/${active.id}`, { data: { sorts } });
  assert(updated.ok(), await updated.text());
  for (let index = views.length; index < count; index += 1) {
    const created = await api.post(path, {
      data: {
        title: `Stress view ${index + 1}`,
        settings: active.settings,
        sorts,
        filter: {
          conjunction: "and",
          rules: [
            { attributeId: "archived", condition: "is-any-of", value: ["active"] },
            {
              attributeId: "priority",
              condition: "is-any-of",
              value: [index % 2 ? "default-priority-high" : "default-priority-medium"],
            },
          ],
        },
      },
    });
    assert(created.ok(), await created.text());
  }
  const final = (await (await api.get(path)).json()) as { views: SavedView[] };
  assert.equal(final.views.length, count);
};
