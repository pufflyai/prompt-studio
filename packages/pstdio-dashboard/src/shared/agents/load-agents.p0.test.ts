import { expect, test } from "bun:test";
import { createClient } from "@pstdio/sdk/client";
import type { AgentDetails } from "pstdio-api-contracts";
import { loadAgents } from "./load-agents";

test("agent discovery includes an installed harness after the first API page", async () => {
  const missing = Array.from(
    { length: 50 },
    (_, index): AgentDetails => ({
      id: `missing-${index}`,
      name: `Missing ${index}`,
      availability: { type: "NOT_FOUND" },
      capabilities: [],
      supportsModels: false,
    }),
  );
  const installed: AgentDetails = {
    id: "installed",
    name: "Installed",
    availability: { type: "INSTALLED" },
    capabilities: [],
    supportsModels: false,
  };
  const projects: Array<string | null> = [];
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      const url = new URL(request.url);
      projects.push(url.searchParams.get("projectId"));
      return Response.json(
        url.searchParams.get("cursor") === "last"
          ? { items: [installed], nextCursor: null }
          : { items: missing, nextCursor: "last" },
      );
    },
  });
  try {
    const agents = await loadAgents(createClient({ baseUrl: server.url.origin }).agents, "project");
    expect(agents).toEqual([...missing, installed]);
    expect(projects).toEqual(["project", "project"]);
  } finally {
    await server.stop(true);
  }
});

test("cancelled agent discovery does not start another page request", async () => {
  const controller = new AbortController();
  let requests = 0;
  const agents = {
    query: async () => {
      requests++;
      if (requests === 1) controller.abort();
      return { items: [], nextCursor: requests === 1 ? "later" : null };
    },
  };
  await expect(loadAgents(agents, "project", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(requests).toBe(1);
});
