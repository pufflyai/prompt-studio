import { afterEach, expect, test } from "bun:test";
import { createProject } from "./project-creation";

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
  expect(await createProject({ path: "/notes/研究" })).toMatchObject({ id: "project" });
  expect(calls.filter(({ method }) => method === "POST")).toHaveLength(1);
  expect(calls[0]!.body).toEqual({
    initial_workspace: { provider_id: "pstdio.root", params: { path: "/notes/研究" } },
  });
});

test("keeps a failed folder setup available for retry instead of opening it as ready", async () => {
  serveProjectSetup("Extension setup failed");
  await expect(createProject({ path: "/notes/研究" })).rejects.toThrow("Extension setup failed");
});
