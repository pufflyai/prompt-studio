import { expect } from "bun:test";

export const expectPlannerIdentities = async (input: {
  baseUrl: string;
  projectId: string;
  headers: Record<string, string>;
}) => {
  const identities = await Promise.all(
    Array.from({ length: 3 }, async (_, index) => {
      const response = await fetch(
        `${input.baseUrl}/v1/projects/${input.projectId}/extensions/commands/pstdio.pstdio-planner.command.create-ticket/execute`,
        {
          method: "POST",
          headers: { ...input.headers, "content-type": "application/json" },
          body: JSON.stringify({ source: "api", params: { title: `Packaged identity ${index}` } }),
        },
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        outcome: { ok: boolean; value: { id: string; shorthand: string } };
      };
      expect(body.outcome.ok).toBe(true);
      return body.outcome.value;
    }),
  );
  expect(new Set(identities.map((identity) => identity.id)).size).toBe(3);
  expect(new Set(identities.map((identity) => identity.shorthand)).size).toBe(3);
  const updateRes = await fetch(
    `${input.baseUrl}/v1/projects/${input.projectId}/extensions/commands/pstdio.pstdio-planner.command.update-ticket/execute`,
    {
      method: "POST",
      headers: { ...input.headers, "content-type": "application/json" },
      body: JSON.stringify({ params: { id: identities[0].shorthand, content: "# Updated identity" } }),
    },
  );
  expect(updateRes.status).toBe(200);
  expect(await updateRes.json()).toMatchObject({
    eventIds: expect.arrayContaining(["pstdio.pstdio-planner.event.tickets.changed"]),
    outcome: { ok: true, value: { id: identities[0].id, title: "Updated identity" } },
  });
};
