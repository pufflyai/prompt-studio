import { expect } from "bun:test";
import { controlsQueryResultSchema } from "pstdio-api-contracts";
import { isLocalizedString } from "pstdio-api-contracts/extension-kernel";
import { text } from "pstdio-extensions/workbench";

export const expectPlannerProperties = async (
  baseUrl: string,
  projectId: string,
  authorization: Record<string, string>,
) => {
  const commandUrl = `${baseUrl}/v1/projects/${projectId}/extensions/commands`;
  const commandHeaders = { ...authorization, "content-type": "application/json" };
  const ticketRes = await fetch(`${commandUrl}/pstdio.pstdio-planner.command.create-ticket/execute`, {
    method: "POST",
    headers: commandHeaders,
    body: JSON.stringify({ source: "api", params: { title: "Properties smoke test" } }),
  });
  expect(ticketRes.status).toBe(200);
  const ticket = (await ticketRes.json()) as { outcome: { ok: boolean; value: { id: string } } };
  expect(ticket.outcome.ok).toBe(true);
  const propertiesRes = await fetch(`${commandUrl}/pstdio.pstdio-planner.command.ticket-properties.query/execute`, {
    method: "POST",
    headers: commandHeaders,
    body: JSON.stringify({
      source: "api",
      params: {},
      resource: { type: "ticket", id: ticket.outcome.value.id },
    }),
  });
  expect(propertiesRes.status).toBe(200);
  // The dashboard resolves localization tokens before validating a controls query.
  const properties = JSON.parse(await propertiesRes.text(), (_key, value) =>
    isLocalizedString(value) ? text(value) : value,
  ) as { outcome: { ok: boolean; value: unknown } };
  expect(properties.outcome.ok).toBe(true);
  const controls = controlsQueryResultSchema.parse(properties.outcome.value);
  expect(controls.params).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "created", type: "readOnly", value: expect.any(String) }),
      expect.objectContaining({ id: "updated", type: "readOnly", value: expect.any(String) }),
      expect.objectContaining({ id: "status", type: "resource", editable: true }),
    ]),
  );
};
