import { expect } from "bun:test";
import { createClient } from "@pstdio/sdk/client";
import type { ResourceRef } from "@pstdio/sdk/extensions";

export const expectGithubResources = async (input: {
  baseUrl: string;
  projectId: string;
  headers: Record<string, string>;
}) => {
  const execute = async <T>(owner: string, command: string, params: object) => {
    const response = await fetch(
      `${input.baseUrl}/v1/projects/${input.projectId}/extensions/commands/pstdio.${owner}.command.${command}/execute`,
      {
        method: "POST",
        headers: { ...input.headers, "content-type": "application/json" },
        body: JSON.stringify({ params }),
      },
    );
    expect(response.status).toBe(200);
    const result = (await response.json()) as { outcome: { ok: boolean; value: T } };
    expect(result.outcome.ok).toBe(true);
    return result.outcome.value;
  };
  const pr = await execute<ResourceRef>("github", "pull-requests.import", {
    url: "https://github.com/Acme/Tools/pull/12/files",
  });
  expect(pr).toMatchObject({
    type: "pull-request",
    extensionId: "pstdio.github",
    projectId: input.projectId,
    id: "https://github.com/acme/tools/pull/12",
  });
  expect(await execute("github", "pull-requests.import", { url: pr.id })).toEqual(pr);
  const ticket = await execute<{ id: string }>("pstdio-planner", "create-ticket", { title: "Linked PR" });
  const source: ResourceRef = { type: "ticket", id: ticket.id, extensionId: "pstdio.pstdio-planner" };
  const client = createClient({
    baseUrl: input.baseUrl,
    fetch: (url, options) =>
      fetch(url, { ...options, headers: { ...Object.fromEntries(new Headers(options?.headers)), ...input.headers } }),
  });
  await client.resources.addAnchors(input.projectId, source, [{ ...pr, role: "context" }]);
  const page = await client.resources.queryAnchors(input.projectId, { resource: source });
  expect(page.items).toContainEqual(
    expect.objectContaining({ target: expect.objectContaining({ id: pr.id, role: "context" }) }),
  );
  const resolved = await execute<{ resource: ResourceRef; target?: unknown }[]>("github", "pull-requests.resolve", {
    resources: [pr],
  });
  expect(resolved[0]).toMatchObject({ resource: pr, target: { kind: "page", page: { id: "pull-request" } } });
  await client.resources.removeAnchors(input.projectId, source, [pr]);
  expect((await client.resources.queryAnchors(input.projectId, { resource: source })).items).toEqual([]);
  expect(await execute("github", "pull-requests.import", { url: pr.id })).toEqual(pr);
};
