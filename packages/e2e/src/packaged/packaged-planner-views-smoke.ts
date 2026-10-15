import { expect } from "bun:test";

export async function expectIndependentPlannerViews(input: {
  baseUrl: string;
  projectId: string;
  headers: Record<string, string>;
  execute: (command: string, params: unknown) => Promise<unknown>;
}) {
  const { baseUrl, projectId, headers, execute } = input;
  const path = `${baseUrl}/v1/projects/${projectId}/boards/pstdio.pstdio-planner.view.tickets/views`;
  const request = async (url: string, method = "GET", body?: unknown) => {
    const response = await fetch(url, {
      method,
      headers: { ...headers, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    expect(response.ok).toBe(true);
    return response.json();
  };
  const ticketView = await request(path, "POST", { title: "Ticket board only" });
  try {
    const timeline = (await execute("timeline.views.read", {})) as { views: { id: string }[] };
    expect(timeline.views.map(({ id }) => id)).not.toContain(ticketView.id);
    const timelineView = (await execute("timeline.views.create", { value: { title: "Timeline only" } })) as {
      id: string;
    };
    try {
      await request(`${path}/default`, "PUT", { viewId: ticketView.id });
      await execute("timeline.views.default", { id: timelineView.id });
      await execute("timeline.views.update", {
        id: timelineView.id,
        value: {
          title: "Timeline focus",
          filter: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "Timeline" }] },
        },
      });
      const board = await request(path);
      expect(board.defaultViewId).toBe(ticketView.id);
      expect(board.views.map((view: { id: string }) => view.id)).not.toContain(timelineView.id);
      expect(board.views.find((view: { id: string }) => view.id === ticketView.id).title).toBe("Ticket board only");
      const saved = await execute("timeline.views.read", {});
      expect(saved).toMatchObject({
        defaultViewId: timelineView.id,
        views: expect.arrayContaining([
          expect.objectContaining({
            id: timelineView.id,
            title: "Timeline focus",
            filter: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "Timeline" }] },
          }),
        ]),
      });
      await request(`${baseUrl}/v1/projects/${projectId}/board-views/${ticketView.id}`, "DELETE");
      expect(await execute("timeline.views.read", {})).toMatchObject({ defaultViewId: timelineView.id });
    } finally {
      await execute("timeline.views.delete", { id: timelineView.id });
    }
  } finally {
    const views = await request(path);
    if (views.views.some((view: { id: string }) => view.id === ticketView.id))
      await request(`${baseUrl}/v1/projects/${projectId}/board-views/${ticketView.id}`, "DELETE");
  }
}
