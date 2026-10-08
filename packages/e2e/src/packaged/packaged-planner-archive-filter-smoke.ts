import { expect } from "bun:test";

export const expectPlannerArchiveFilters = async (
  baseUrl: string,
  projectId: string,
  authorization: Record<string, string>,
) => {
  const execute = async (command: string, params: Record<string, unknown>) => {
    const response = await fetch(
      `${baseUrl}/v1/projects/${projectId}/extensions/commands/pstdio.pstdio-planner.command.${command}/execute`,
      {
        method: "POST",
        headers: { ...authorization, "content-type": "application/json" },
        body: JSON.stringify({ source: "api", params }),
      },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.outcome.ok).toBe(true);
    return body.outcome.value;
  };

  const active = await execute("create-ticket", { title: "Archive filter smoke active" });
  const archived = await execute("create-ticket", { title: "Archive filter smoke archived" });
  try {
    await execute("archive-ticket", { id: archived.id });
    const all = await execute("query-tickets", { filters: {} });
    expect(all.rows).toContainEqual(expect.objectContaining({ id: active.id }));
    expect(all.rows).toContainEqual(expect.objectContaining({ id: archived.id }));

    const activeOnly = await execute("query-tickets", { filters: { archived: ["active"] } });
    expect(activeOnly.rows).toContainEqual(expect.objectContaining({ id: active.id }));
    expect(activeOnly.rows).not.toContainEqual(expect.objectContaining({ id: archived.id }));

    const archivedOnly = await execute("query-tickets", { filters: { archived: ["archived"] } });
    expect(archivedOnly.rows).toContainEqual(expect.objectContaining({ id: archived.id }));
    expect(archivedOnly.rows).not.toContainEqual(expect.objectContaining({ id: active.id }));
  } finally {
    await execute("delete-ticket", { id: active.id });
    await execute("delete-ticket", { id: archived.id });
  }
};
