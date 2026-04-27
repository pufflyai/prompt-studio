import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cliEntrypoint = fileURLToPath(new URL("../../../index.ts", import.meta.url));

const createCliEnv = (overrides: NodeJS.ProcessEnv = {}) => {
  const env = { ...process.env, ...overrides };
  delete env.FORCE_COLOR;
  delete env.NO_COLOR;
  return env;
};

let tempDirs: string[] = [];
let apiServers: Array<ReturnType<typeof Bun.serve>> = [];

const createProject = () => {
  const projectRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-cli-regression-"));
  tempDirs.push(projectRoot);
  mkdirSync(join(projectRoot, ".git"), { recursive: true });
  mkdirSync(join(projectRoot, ".pstdio"), { recursive: true });
  writeFileSync(join(projectRoot, ".pstdio", "config.json"), `${JSON.stringify({ project_id: "proj-1" })}\n`);
  return projectRoot;
};

const writeExtension = (projectRoot: string, extensionDir: string, source: string) => {
  const dir = join(projectRoot, ".pstdio", "extensions", extensionDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "extension.ts"), source);
};

const writeTicketsExtension = (projectRoot: string) => {
  writeExtension(
    projectRoot,
    "pstdio.tickets",
    `export default {
      id: "pstdio.tickets",
      name: "Tickets",
      commands: {
        pullTickets: {
          title: "Pull tickets",
          cli: {
            path: "tickets pull",
            options: {
              id: { type: "string", description: "Ticket shorthand" },
            },
          },
          run() {
            return "extension pull";
          },
        },
      },
    };`,
  );
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

describe("extension command CLI routing regressions", () => {
  test("loads extension commands under built-in namespaces outside the hint registry", async () => {
    const projectRoot = createProject();
    writeExtension(
      projectRoot,
      "project.review",
      `export default {
        id: "project.review",
        name: "Project Review",
        commands: {
          runReview: {
            title: "Run review",
            cli: {
              path: "workspaces review",
              description: "Start a workspace review",
            },
            run() {
              return "extension review";
            },
          },
        },
      };`,
    );
    let requestPath = "";
    const apiUrl = createApiServer((request) => {
      const url = new URL(request.url);
      if (url.pathname === "/healthz") {
        return jsonResponse({ ok: true });
      }

      requestPath = url.pathname;
      return jsonResponse({ result: "extension review" });
    });

    const output = await runCli({
      cmd: ["bun", cliEntrypoint, "workspaces", "review"],
      cwd: projectRoot,
      env: createCliEnv({
        PSTDIO_API_URL: apiUrl,
        PSTDIO_DISABLE_API_AUTO_START: "1",
        PSTDIO_DISABLE_EMBED_MANIFEST: "1",
      }),
    });

    expect(output.exitCode).toBe(0);
    expect(output.stdout).toBe("extension review\n");
    expect(output.stderr).toBe("");
    expect(requestPath).toBe("/v1/projects/proj-1/extension-commands/project.review.runReview/execute");
  });

  test("matches disabled-extension recovery hints when command options have values", async () => {
    const projectRoot = createProject();
    writeTicketsExtension(projectRoot);
    let requestBody: unknown;
    const apiUrl = createApiServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/healthz") {
        return jsonResponse({ ok: true });
      }

      requestBody = await request.json();
      return jsonResponse(
        {
          error:
            'Command "tickets pull" is unavailable because no enabled extension provides it. It is normally provided by "pstdio.tickets". Extension "pstdio.tickets" is disabled for this project.',
        },
        { status: 400 },
      );
    });

    const output = await runCli({
      cmd: ["bun", cliEntrypoint, "tickets", "pull", "--id", "PS-1"],
      cwd: projectRoot,
      env: createCliEnv({
        PSTDIO_API_URL: apiUrl,
        PSTDIO_DISABLE_API_AUTO_START: "1",
        PSTDIO_DISABLE_EMBED_MANIFEST: "1",
        PSTDIO_LOG_LEVEL: "fatal",
      }),
    });

    expect(output.exitCode).toBe(1);
    expect(output.stderr).toContain('Command "tickets pull" is unavailable because no enabled extension provides it.');
    expect(output.stderr).toContain('It is normally provided by "pstdio.tickets".');
    expect(output.stderr).toContain('Extension "pstdio.tickets" is disabled for this project.');
    expect(output.stderr).not.toContain("PS-1");
    expect(output.stdout).toBe("");
    expect(requestBody).toEqual({ params: { id: "PS-1" } });
  });
});
