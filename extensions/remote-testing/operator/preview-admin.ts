import { createHash, randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";

const workDir = "/workspace/pstdio-https";
const configPath = workDir + "/preview.json";
const local = "http://127.0.0.1:3030";
let preparing: Promise<Response> | undefined;
type Preview = { workspaceId: string; expiresAt: number; origin: string };

async function config(): Promise<Preview | null> {
  return Bun.file(configPath)
    .json()
    .catch(() => null);
}

async function prepare(request: Request) {
  const input = (await request.json()) as Preview;
  if (
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(input.workspaceId) ||
    !Number.isFinite(input.expiresAt) ||
    input.expiresAt <= Date.now() ||
    input.expiresAt > Date.now() + 90 * 60_000 ||
    !/^https:\/\/[a-z0-9.-]+$/.test(input.origin)
  )
    return new Response("Invalid preview", { status: 400 });
  const existing = await config();
  if (existing) {
    const health = await fetch("http://127.0.0.1:8080/__preview/health", {
      signal: AbortSignal.timeout(2000),
    }).catch(() => null);
    if (health?.ok && existing.workspaceId === input.workspaceId) return Response.json(existing);
    if (existing.expiresAt <= Date.now()) return new Response("Expired preview", { status: 410 });
    if (existing.workspaceId !== input.workspaceId) return new Response("Different preview", { status: 409 });
  }
  const runtime = await Bun.file("/workspace/preview-home/.pstdio/runtime.json")
    .json()
    .catch(() => null);
  if (!runtime?.token) return new Response("Starting", { status: 425 });
  const response = await fetch(local + "/v1/projects", {
    headers: { Authorization: "Bearer " + runtime.token },
    signal: AbortSignal.timeout(2000),
  }).catch(() => null);
  if (!response?.ok || !((await response.json()) as unknown[]).length) return new Response("Starting", { status: 425 });

  await mkdir(workDir + "/invitations", { recursive: true, mode: 0o700 });
  await Bun.write(configPath, JSON.stringify(existing ?? input));
  for (const name of ["PREVIEW_GATE", "PREVIEW_WEBVIEWS"]) {
    const source = process.env[name];
    if (!source) throw new Error("Missing preview service source.");
    Bun.spawn([process.execPath, "-e", source], { stdin: "ignore", stdout: "inherit", stderr: "inherit" });
  }
  return Response.json(existing ?? input);
}

Bun.serve({
  hostname: "127.0.0.1",
  port: 8082,
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
    await Bun.write(workDir + "/invitations/" + digest, "");
    return Response.json({ invite, expiresAt: new Date(preview.expiresAt).toISOString() });
  },
});
