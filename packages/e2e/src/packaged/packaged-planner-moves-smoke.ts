import { expect } from "bun:test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";

export const expectPackagedPlannerMoves = async (input: {
  baseUrl: string;
  projectId: string;
  headers: Record<string, string>;
  metadata: WorkbenchExtensionMetadata;
}) => {
  const execute = async (id: string, params: unknown) => {
    const response = await fetch(`${input.baseUrl}/v1/projects/${input.projectId}/extensions/commands/${id}/execute`, {
      method: "POST",
      headers: { ...input.headers, "content-type": "application/json" },
      body: JSON.stringify({ params }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.outcome.status, JSON.stringify(body)).toBe("success");
    return body;
  };
  const command = (name: string, params: unknown) => execute(`pstdio.pstdio-planner.command.${name}`, params);
  const board = input.metadata.views.find(
    (view) => view.extensionId === "pstdio.pstdio-planner" && view.localId === "tickets",
  );
  if (board?.body.kind !== "kanban" || !board.body.moveHandlerId)
    throw new Error("Expected the packaged move callback");
  expect(board.body.schemaRefreshEventIds).toEqual(["pstdio.pstdio-planner.event.schema.changed"]);
  const first = (await command("create-ticket", { title: "Move smoke first" })).outcome.value;
  const last = (await command("create-ticket", { title: "Move smoke last" })).outcome.value;
  const moved = await execute(board.body.moveHandlerId, {
    rowId: last.id,
    attributes: { status: "ready", priority: "default-priority-high" },
    order: { beforeRowId: first.id },
  });
  expect(moved.outcome.value).toEqual({ changed: 1 });
  expect(moved.eventIds.filter((id: string) => id.startsWith("pstdio.pstdio-planner.event."))).toEqual([
    "pstdio.pstdio-planner.event.tickets.changed",
  ]);
  const saved = (await command("get-ticket", { id: last.id })).outcome.value;
  expect(saved).toMatchObject({ statusId: "ready", tagIds: ["default-priority-high"] });
  expect(saved.sortOrder).toBeLessThan(first.sortOrder);
  const repeated = await execute(board.body.moveHandlerId, {
    rowId: last.id,
    attributes: { status: "ready" },
    order: { beforeRowId: first.id },
  });
  expect(repeated.outcome.value).toEqual({ changed: 0 });
  expect((repeated.eventIds ?? []).filter((id: string) => id.startsWith("pstdio.pstdio-planner.event."))).toEqual([]);
};
