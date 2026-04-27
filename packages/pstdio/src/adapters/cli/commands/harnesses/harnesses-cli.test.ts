import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cliEntrypoint = fileURLToPath(new URL("../../../../index.ts", import.meta.url));

let tempDirs: string[] = [];
let apiServers: Array<ReturnType<typeof Bun.serve>> = [];

const createCliEnv = (overrides: NodeJS.ProcessEnv = {}) => {
  const env = { ...process.env, ...overrides };
  delete env.FORCE_COLOR;
  delete env.NO_COLOR;
  return env;
};

const createProject = () => {
  const projectRoot = mkdtempSync(join(tmpdir(), "pstdio-harnesses-cli-"));
  tempDirs.push(projectRoot);
  mkdirSync(join(projectRoot, ".git"), { recursive: true });
  mkdirSync(join(projectRoot, ".pstdio"), { recursive: true });
  writeFileSync(join(projectRoot, ".pstdio", "config.json"), `${JSON.stringify({ project_id: "project-1" })}\n`);
  return projectRoot;
};

const jsonResponse = (body: unknown, init: ResponseInit = {}) => {
  const { headers: _headers, ...rest } = init;
  return Response.json(body, { ...rest, headers: { connection: "close" } });
};

const createApiServer = (handler: (request: Request) => Response | Promise<Response>) => {
  const server = Bun.serve({
    port: 0,
    fetch: handler,
  });
  apiServers.push(server);
  return server.url.origin;
};

const runCli = async (input: { cmd: string[]; cwd: string; env: NodeJS.ProcessEnv }) => {
  const child = Bun.spawn({
    ...input,
    stderr: "pipe",
    stdout: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  return { stdout, stderr, exitCode };
};

afterEach(() => {
  for (const server of apiServers) {
    server.stop(true);
  }
  apiServers = [];

  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("harnesses CLI", () => {
  test("starts harness sessions through the harness API ingress", async () => {
    const projectRoot = createProject();
    let requestPath = "";
    let requestBody: unknown;
    const apiUrl = createApiServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/healthz") return jsonResponse({ ok: true });

      requestPath = url.pathname;
      requestBody = await request.json();
      return jsonResponse({
        id: "session-1",
        project_id: "project-1",
        title: "Harness run",
        status: "in_progress",
        archived: false,
        last_request_started: null,
        last_request_ended: null,
        agent: "pstdio.harness.fake",
        agent_session_id: null,
        session_file_id: null,
        original_session_id: null,
        cwd: null,
        created_at: "2026-04-27T00:00:00.000Z",
        updated_at: "2026-04-27T00:00:00.000Z",
      });
    });

    const output = await runCli({
      cmd: [
        "bun",
        cliEntrypoint,
        "harnesses",
        "start",
        "--prompt",
        "hello",
        "--title",
        "Harness run",
        "--harness",
        "pstdio.harness.fake",
      ],
      cwd: projectRoot,
      env: createCliEnv({
        PSTDIO_API_URL: apiUrl,
        PSTDIO_DISABLE_API_AUTO_START: "1",
        PSTDIO_DISABLE_EMBED_MANIFEST: "1",
      }),
    });

    expect(output.exitCode).toBe(0);
    expect(output.stderr).toBe("");
    expect(output.stdout).toContain("Created harness session session-1");
    expect(output.stdout).toContain("Harness: pstdio.harness.fake");
    expect(requestPath).toBe("/v1/harnesses/sessions");
    expect(requestBody).toEqual({
      project_id: "project-1",
      title: "Harness run",
      prompt: "hello",
      harness: "pstdio.harness.fake",
    });
  });

  test("old agents namespace fails with harness command guidance", async () => {
    const output = await runCli({
      cmd: ["bun", cliEntrypoint, "agents", "list"],
      cwd: createProject(),
      env: createCliEnv({
        PSTDIO_DISABLE_API_AUTO_START: "1",
        PSTDIO_DISABLE_EMBED_MANIFEST: "1",
      }),
    });

    expect(output.exitCode).toBe(1);
    expect(output.stdout).toBe("");
    expect(output.stderr).toContain("pstdio agents is no longer available");
    expect(output.stderr).toContain("pstdio harnesses");
  });
});
