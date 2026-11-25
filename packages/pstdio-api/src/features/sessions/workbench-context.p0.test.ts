import { expect, test } from "bun:test";
import type { WorkbenchContext, WorkbenchOrigin } from "pstdio-api-contracts/workbench-context";
import type { SessionsRouteDeps } from "./deps";
import { createWorkbenchContextRoutes, submittedWorkbenchOrigin } from "./workbench-context";

const snapshot = (project: string, page: string): WorkbenchContext => ({
  observedAt: new Date().toISOString(),
  project: { id: project },
  main: { page: { id: page, extensionId: "example.owner" } },
  panels: [],
  selection: { kind: "unsupported" },
});

test("an attached request reads only its own client and keeps its send-time subject", async () => {
  const selected: WorkbenchOrigin = { id: crypto.randomUUID(), snapshot: snapshot("project", "sent") };
  const other = crypto.randomUUID();
  const route = createWorkbenchContextRoutes({
    projectService: { get: async () => ({}) },
    sessionService: {
      get: async () => ({ project_id: "project" }),
      store: { get: (id: string) => (id === "session" ? { workbenchOrigin: selected } : undefined) },
    },
  } as unknown as SessionsRouteDeps);
  for (const [id, page] of [
    [selected.id, "updated"],
    [other, "another-client"],
  ]) {
    const response = await route.request(`/projects/project/workbench-context/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(snapshot("project", page!)),
    });
    expect(response.status).toBe(204);
  }
  const path = "/projects/project/sessions/session/workbench-context";
  expect(await (await route.request(path)).json()).toMatchObject({
    status: "available",
    freshness: "live",
    context: { main: { page: { id: "updated" } } },
  });
  expect(await (await route.request(`${path}?atSend=true`)).json()).toMatchObject({
    status: "available",
    freshness: "at-send",
    context: { main: { page: { id: "sent" } } },
  });
  expect(await (await route.request(path.replace("/project/", "/other-project/"))).json()).toMatchObject({
    status: "unavailable",
    reason: "session-unavailable",
  });
  await route.request(`/projects/project/workbench-context/${selected.id}`, { method: "DELETE" });
  expect(await (await route.request(path)).json()).toMatchObject({ status: "unavailable" });
  expect(await (await route.request(path.replace("/session/", "/headless/"))).json()).toMatchObject({
    status: "unavailable",
    reason: "no-attached-workbench",
  });
});

test("a submission cannot contain references from another project's workbench", () => {
  const source = snapshot("project", "source");
  source.main.resource = { id: "other", extensionId: "example.owner", type: "note", projectId: "other" };
  expect(submittedWorkbenchOrigin({ id: crypto.randomUUID(), snapshot: source }, "project")).toBeUndefined();
});
