import { createHash, randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";

type Preview = { workspaceId: string; expiresAt: number; origin: string };

function validPreview(input: Preview, now: number) {
  return (
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(input.workspaceId) &&
    Number.isFinite(input.expiresAt) &&
    input.expiresAt > now &&
    input.expiresAt <= now + 90 * 60_000 &&
    /^https:\/\/[a-z0-9.-]+$/.test(input.origin)
  );
}

async function serviceHealthy(port: number) {
  const response = await fetch(`http://127.0.0.1:${port}/__preview/health`, {
    signal: AbortSignal.timeout(2000),
  }).catch(() => null);
  return response?.ok === true;
}

export function createPreviewAdmin({
  workDir = "/workspace/pstdio-https",
  runtimePath = "/workspace/preview-home/.pstdio/runtime.json",
  local = "http://127.0.0.1:3030",
  port = 8082,
  services = [
    { port: 8080, source: process.env.PREVIEW_GATE },
    { port: 8081, source: process.env.PREVIEW_WEBVIEWS },
  ],
} = {}) {
  const configPath = `${workDir}/preview.json`;
  const children = new Map<number, Bun.Subprocess>();
  let preparing: Promise<Response> | undefined;

  const config = (): Promise<Preview | null> =>
    Bun.file(configPath)
      .json()
      .catch(() => null);

  async function workspaceReady() {
    const runtime = await Bun.file(runtimePath)
      .json()
      .catch(() => null);
    if (!runtime?.token) return false;
    const response = await fetch(`${local}/v1/projects`, {
      headers: { Authorization: `Bearer ${runtime.token}` },
      signal: AbortSignal.timeout(2000),
    }).catch(() => null);
    return response?.ok === true && ((await response.json()) as unknown[]).length > 0;
  }

  function startServices(missing: typeof services) {
    for (const service of missing) {
      if (children.get(service.port)?.exitCode === null) continue;
      if (!service.source) throw new Error("Missing preview service source.");
      const child = Bun.spawn([process.execPath, "-e", service.source], {
        stdin: "ignore",
        stdout: "inherit",
        stderr: "inherit",
      });
      children.set(service.port, child);
    }
  }

  async function prepare(request: Request) {
    const input = (await request.json()) as Preview;
    if (!validPreview(input, Date.now())) return new Response("Invalid preview", { status: 400 });
    const existing = await config();
    if (existing && existing.expiresAt <= Date.now()) return new Response("Expired preview", { status: 410 });
    if (existing && existing.workspaceId !== input.workspaceId)
      return new Response("Different preview", { status: 409 });
    const healthy = existing ? await Promise.all(services.map((service) => serviceHealthy(service.port))) : [];
    const missing = services.filter((_, index) => !healthy[index]);
    if (!missing.length) return Response.json(existing ?? input);
    if (!(await workspaceReady())) return new Response("Starting", { status: 425 });

    if (!existing) {
      await mkdir(`${workDir}/invitations`, { recursive: true, mode: 0o700 });
      await Bun.write(configPath, JSON.stringify(input));
    }
    startServices(missing);
    return new Response("Starting", { status: 425 });
  }

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    maxRequestBodySize: 4096,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (request.method === "GET" && path === "/healthz") return new Response("ok");
      if (request.method !== "POST") return new Response("Not found", { status: 404 });
      if (path === "/prepare") {
        if (preparing) return new Response("Starting", { status: 425 });
        preparing = prepare(request);
        try {
          return await preparing;
        } finally {
          preparing = undefined;
        }
      }
      if (path !== "/invite") return new Response("Not found", { status: 404 });
      const preview = await config();
      if (!preview || preview.expiresAt <= Date.now()) return new Response("Preview expired", { status: 410 });
      const invite = randomBytes(32).toString("base64url");
      const digest = createHash("sha256").update(invite).digest("hex");
      await Bun.write(`${workDir}/invitations/${digest}`, "");
      return Response.json({ invite, expiresAt: new Date(preview.expiresAt).toISOString() });
    },
  });
  return {
    url: server.url,
    async stop() {
      await server.stop(true);
      await Promise.all(
        [...children.values()].map(async (child) => {
          if (child.exitCode === null) child.kill();
          await child.exited;
        }),
      );
    },
  };
}

if (import.meta.main) createPreviewAdmin();
