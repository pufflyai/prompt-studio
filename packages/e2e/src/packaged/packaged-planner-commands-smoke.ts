import { expect } from "bun:test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { expectPlannerArchiveFilters } from "./packaged-planner-archive-filter-smoke";
import { expectPlannerDocumentLinks } from "./packaged-planner-document-links-smoke";
import { commandRunner } from "./packaged-planner-helpers";

export const expectPlannerCommands = async (
  baseUrl: string,
  projectId: string,
  headers: Record<string, string>,
  metadata: WorkbenchExtensionMetadata,
) => {
  const commandId = "pstdio.planner.command.open-tickets";
  expect(metadata.commands).toContainEqual(expect.objectContaining({ id: commandId }));
  expect(metadata.commandPaletteContributions).toContainEqual(expect.objectContaining({ commandId }));
  expect(metadata.commands).toContainEqual(
    expect.objectContaining({ id: "pstdio.pstdio-planner.command.cleanup-board" }),
  );
  const tickets = metadata.pages.find(({ localId }) => localId === "tickets");
  if (tickets?.main.kind !== "view" || !tickets.main.tab) throw new Error("Missing Tickets breadcrumb menu");
  const menu = await fetch(
    `${baseUrl}/v1/projects/${projectId}/extensions/commands/${tickets.main.tab.queryHandlerId}/execute`,
    {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ params: { renderer: { rendererId: "pstdio.pstdio-planner.view.tickets", projectId } } }),
    },
  );
  expect(menu.status).toBe(200);
  expect(await menu.json()).toMatchObject({
    outcome: {
      status: "success",
      value: { menu: [{ id: "tickets", rows: [{ id: "cleanup-board", action: { kind: "command" } }] }] },
    },
  });
  const cleanup = await commandRunner({ baseUrl, projectId, headers })("templates.read", { name: "cleanup-board" });
  expect(cleanup).toMatchObject({
    name: "cleanup-board",
    type: "prompt",
    content: await Bun.file(
      new URL("../../../../extensions/pstdio-planner/templates/prompts/cleanup-board.prompt.md", import.meta.url),
    ).text(),
  });
  const refineTicket = metadata.commands.find((command) => command.id.endsWith(".command.refine-ticket"));
  expect(refineTicket?.params?.template).toEqual({
    type: "template",
    label: "Ticket template",
    required: false,
    templateType: "pstdio.planner.template-type.ticket",
  });
  const response = await fetch(`${baseUrl}/v1/projects/${projectId}/extensions/commands/${commandId}/execute`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ source: "dashboard", params: {} }),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    outcome: {
      status: "success",
      navigationRequests: [{ kind: "page", page: { kind: "page", id: "tickets", extensionId: "pstdio.planner" } }],
    },
  });
  await expectPlannerArchiveFilters(baseUrl, projectId, headers);
  await expectPlannerDocumentLinks(baseUrl, projectId, headers, metadata);
};
