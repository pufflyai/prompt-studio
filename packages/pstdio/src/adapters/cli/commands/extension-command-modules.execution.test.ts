import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cliEntrypoint = fileURLToPath(new URL("../../../index.ts", import.meta.url));

let tempDirs: string[] = [];
let apiServers: Array<ReturnType<typeof Bun.serve>> = [];

const createCliEnv = (overrides: NodeJS.ProcessEnv = {}) => {
  const env = { ...process.env, ...overrides };
  delete env.FORCE_COLOR;
  delete env.NO_COLOR;
  return env;
};

const createProject = () => {
  const projectRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-command-execution-"));
  tempDirs.push(projectRoot);
  const projectId = "project-1";

  mkdirSync(join(projectRoot, ".git"), { recursive: true });
  mkdirSync(join(projectRoot, ".pstdio"), { recursive: true });
  writeFileSync(join(projectRoot, ".pstdio", "config.json"), `${JSON.stringify({ project_id: projectId })}\n`);

  return { projectRoot, projectId };
};

const writeExtension = (projectRoot: string) => {
  const dir = join(projectRoot, ".pstdio", "extensions", "extension-lab");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "extension.ts"),
    `export default {
      id: "project.extension-lab",
      name: "Extension Lab",
      commands: {
        inspectProject: {
          title: "Inspect project",
          target: "project",
          params: {
            note: { type: "text" },
            count: { type: "text" },
            verbose: { type: "boolean" },
          },
          cli: {
            path: "extension-lab inspect",
            description: "Inspect extension lab",
            options: {
              note: { type: "string", description: "Note" },
              count: { type: "number", description: "Count" },
              verbose: { type: "boolean", description: "Verbose output" },
            },
          },
          async run(ctx) {
            await ctx.storage.set("lastCliRun", {
              projectId: ctx.projectId,
              target: ctx.target,
              params: ctx.params,
            });

            return {
              projectId: ctx.projectId,
              targetType: ctx.target.type,
              note: ctx.params.note,
              count: ctx.params.count,
              verbose: ctx.params.verbose,
            };
          },
        },
      },
    };`,
  );
};

const writeWorkspaceTargetExtension = (projectRoot: string) => {
  const dir = join(projectRoot, ".pstdio", "extensions", "extension-lab");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "extension.ts"),
    `export default {
      id: "project.extension-lab",
      name: "Extension Lab",
      commands: {
        inspectWorkspace: {
          title: "Inspect workspace",
          target: "workspace",
          cli: {
            path: "extension-lab inspect-workspace",
            description: "Inspect a workspace",
          },
          run(ctx) {
            return {
              target: ctx.target,
            };
          },
        },
      },
    };`,
  );
};

const createApiServer = (handler: (request: Request) => Response | Promise<Response>) => {
  const server = Bun.serve({
    port: 0,
    fetch: handler,
  });
  apiServers.push(server);
  return server.url.origin;
};

const jsonResponse = (body: unknown, init: ResponseInit = {}) => {
  const { headers: _headers, ...rest } = init;
  return Response.json(body, { ...rest, headers: { connection: "close" } });
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

describe("extension command execution from the real CLI", () => {
  test("executes local extension commands through the API service", async () => {
    const { projectRoot, projectId } = createProject();
    writeExtension(projectRoot);
    let requestBody: unknown;
    let requestPath = "";

    const apiUrl = createApiServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/healthz") {
        return jsonResponse({ ok: true });
      }

      requestPath = url.pathname;
      requestBody = await request.json();

      return jsonResponse({
        result: {
          projectId,
          targetType: "project",
          note: "hello",
          count: 2,
          verbose: true,
        },
      });
    });

    const output = await runCli({
      cmd: ["bun", cliEntrypoint, "extension-lab", "inspect", "--note", "hello", "--count", "2", "--verbose"],
      cwd: projectRoot,
      env: createCliEnv({
        PSTDIO_API_URL: apiUrl,
        PSTDIO_DISABLE_API_AUTO_START: "1",
        PSTDIO_DISABLE_EMBED_MANIFEST: "1",
      }),
    });

    expect(output.exitCode).toBe(0);
    expect(output.stderr).toBe("");
    expect(output.stdout).not.toContain("[createDb]");
    expect(output.stdout).toContain(`"projectId": "${projectId}"`);
    expect(output.stdout).toContain('"targetType": "project"');
    expect(output.stdout).toContain('"note": "hello"');
    expect(output.stdout).toContain('"count": 2');
    expect(output.stdout).toContain('"verbose": true');

    expect(requestPath).toBe(
      `/v1/projects/${projectId}/extension-commands/project.extension-lab.inspectProject/execute`,
    );
    expect(requestBody).toEqual({
      params: {
        __cli: true,
        note: "hello",
        count: 2,
        verbose: true,
      },
    });
  });

  test("rejects non-project targets until the CLI provides a target resolver", async () => {
    const { projectRoot } = createProject();
    writeWorkspaceTargetExtension(projectRoot);
    const apiUrl = createApiServer((request) => {
      const url = new URL(request.url);
      if (url.pathname === "/healthz") {
        return jsonResponse({ ok: true });
      }

      return jsonResponse(
        {
          error:
            'Extension command "project.extension-lab.inspectWorkspace" targets "workspace" and requires an explicit workspace target.',
        },
        { status: 400 },
      );
    });

    const output = await runCli({
      cmd: ["bun", cliEntrypoint, "extension-lab", "inspect-workspace"],
      cwd: projectRoot,
      env: createCliEnv({
        PSTDIO_API_URL: apiUrl,
        PSTDIO_DISABLE_API_AUTO_START: "1",
        PSTDIO_DISABLE_EMBED_MANIFEST: "1",
      }),
    });

    expect(output.exitCode).toBe(1);
    expect(output.stdout).toBe("");
    expect(output.stderr).toContain('targets "workspace"');
    expect(output.stderr).toContain("requires an explicit workspace target");
  });
});
