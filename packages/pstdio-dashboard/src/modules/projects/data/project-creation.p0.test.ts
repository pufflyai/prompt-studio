import { afterEach, expect, test } from "bun:test";
import { getProjectCreation } from "./project-creation";

const originalConfig = Object.getOwnPropertyDescriptor(globalThis, "__PSTDIO_CONFIG__");
const servers: ReturnType<typeof Bun.serve>[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true);
  if (originalConfig) Object.defineProperty(globalThis, "__PSTDIO_CONFIG__", originalConfig);
  else Reflect.deleteProperty(globalThis, "__PSTDIO_CONFIG__");
});

const serveProjectSetup = (setupError: string | null = null) => {
  const calls: { method: string; body: unknown }[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      if (new URL(request.url).pathname === "/v1/account") return Response.json({ cloudProjects: [] });
      calls.push({ method: request.method, body: request.method === "POST" ? await request.json() : undefined });
      if (request.method === "POST") return Response.json({ id: "project", name: "研究" }, { status: 201 });
      return Response.json([
        { is_default: true, setup_error: setupError, provider_state: "ready", root_path: "/notes/研究" },
      ]);
    },
  });
  servers.push(server);
  Object.defineProperty(globalThis, "__PSTDIO_CONFIG__", {
    configurable: true,
    value: { apiBaseUrl: server.url.origin },
  });
  return calls;
};

test("opens a folder through server-owned initialization and verifies its workspace", async () => {
  const calls = serveProjectSetup();
  expect(await getProjectCreation().open("/notes/研究")).toMatchObject({ id: "project" });
  expect(calls.filter(({ method }) => method === "POST")).toHaveLength(1);
  expect(calls[0]!.body).toEqual({
    initial_workspace: { provider_id: "pstdio.root", params: { path: "/notes/研究" } },
  });
});

test("keeps a failed folder setup available for retry instead of opening it as ready", async () => {
  serveProjectSetup("Extension setup failed");
  await expect(getProjectCreation().open("/notes/研究")).rejects.toThrow("Extension setup failed");
});

test("retains the acknowledged project when its readiness read times out", async () => {
  const calls: string[] = [];
  let failRead = true;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/v1/account") return Response.json({ cloudProjects: [] });
      calls.push(`${request.method} ${url.pathname}`);
      if (request.method === "POST")
        return Response.json({ id: "project", name: "研究", created: true }, { status: 201 });
      if (failRead) {
        failRead = false;
        return Response.json({ error: "Workspace read interrupted" }, { status: 503 });
      }
      expect(url.searchParams.get("projectId")).toBe("project");
      return Response.json([{ is_default: true, provider_state: "ready", root_path: "/notes/研究" }]);
    },
  });
  servers.push(server);
  Object.defineProperty(globalThis, "__PSTDIO_CONFIG__", {
    configurable: true,
    value: { apiBaseUrl: server.url.origin },
  });

  const owner = getProjectCreation();
  const first = owner.open("/notes/研究");
  expect(owner.read().pending).toMatchObject([{ intent: "/notes/研究" }]);
  await expect(first).rejects.toThrow("Workspace read interrupted");
  expect(owner.read().recovery[0]).toMatchObject({
    status: "unconfirmed",
    draft: { path: "/notes/研究", project: { id: "project", name: "研究" } },
  });
  expect(await getProjectCreation().open("/notes/研究")).toMatchObject({ id: "project", name: "研究", created: true });
  expect(calls).toEqual(["POST /v1/projects", "GET /v1/workspaces", "GET /v1/workspaces"]);
  expect(owner.read()).toEqual({ pending: [], recovery: [] });
});
