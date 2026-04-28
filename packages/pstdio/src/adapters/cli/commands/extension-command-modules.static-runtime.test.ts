import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  const projectRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-static-cli-"));
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
    "project.tickets",
    `export default {
      id: "project.tickets",
      name: "Tickets",
      commands: {
        syncTickets: {
          title: "Sync tickets",
          target: "project",
          cli: {
            path: "tickets sync",
            description: "Sync tickets into .pstdio/tickets",
            options: {
              id: { type: "string", description: "Ticket shorthand" },
              force: { type: "boolean", description: "Overwrite local files" },
            },
            examples: ["pstdio tickets sync --id PS-1"],
          },
          run() {
            return "extension sync";
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

describe("runtime-backed extension command routing for static namespaces", () => {
  test("prints extension commands in top-level help from the registry", () => {
    const projectRoot = createProject();
    writeExtension(
      projectRoot,
      "extension-lab",
      `export default {
        id: "extension-lab",
        name: "Extension Lab",
        commands: {
          inspect: {
            title: "Inspect",
            cli: {
              path: "extension-lab inspect",
              description: "Inspect extension lab",
              examples: ["pstdio extension-lab inspect --json"],
            },
            run() {},
          },
        },
      };`,
    );

    const output = Bun.spawnSync({
      cmd: ["bun", cliEntrypoint, "--help"],
      cwd: projectRoot,
      env: createCliEnv({ PSTDIO_DISABLE_EMBED_MANIFEST: "1" }),
      stderr: "pipe",
      stdout: "pipe",
    });

    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);

    expect(output.exitCode).toBe(0);
    expect(stdout).toContain("extension-lab inspect");
    expect(stdout).toContain("id: extension-lab.inspect");
    expect(stdout).toContain("extension: extension-lab");
    expect(stdout).toContain("example: pstdio extension-lab inspect --json");
    expect(stderr).toBe("");
  });

  test("merges extension command metadata into static namespace help", () => {
    const projectRoot = createProject();
    writeTicketsExtension(projectRoot);

    const output = Bun.spawnSync({
      cmd: ["bun", cliEntrypoint, "tickets", "--help"],
      cwd: projectRoot,
      env: createCliEnv({
        PSTDIO_DISABLE_API_AUTO_START: "1",
        PSTDIO_DISABLE_EMBED_MANIFEST: "1",
      }),
      stderr: "pipe",
      stdout: "pipe",
    });

    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);

    expect(output.exitCode).toBe(0);
    expect(stdout).toContain("Sync tickets into .pstdio/tickets");
    expect(stdout).toContain("id: project.tickets.syncTickets");
    expect(stdout).toContain("extension: project.tickets");
    expect(stdout).toContain("example: pstdio tickets sync --id PS-1");
    expect(stderr).toBe("");
  });

  test("does not duplicate built-in commands when planner metadata shares static ticket paths", () => {
    const projectRoot = createProject();

    const output = Bun.spawnSync({
      cmd: ["bun", cliEntrypoint, "tickets", "--help"],
      cwd: projectRoot,
      env: createCliEnv({
        PSTDIO_DISABLE_API_AUTO_START: "1",
        PSTDIO_DISABLE_EMBED_MANIFEST: "1",
      }),
      stderr: "pipe",
      stdout: "pipe",
    });

    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);
    const updateCommandRows = stdout
      .split("\n")
      .filter((line) => line.trimStart().startsWith("pstdio tickets update "))
      .filter((line) => !line.includes("update-when-attempt-status"));

    expect(output.exitCode).toBe(0);
    expect(updateCommandRows).toHaveLength(1);
    expect(stdout).toContain("id: pstdio.planner.updateTicket");
    expect(stderr).toBe("");
  });

  test("prints command-level provider metadata for extension commands in static namespaces", () => {
    const projectRoot = createProject();
    writeTicketsExtension(projectRoot);

    const output = Bun.spawnSync({
      cmd: ["bun", cliEntrypoint, "tickets", "sync", "--help"],
      cwd: projectRoot,
      env: createCliEnv({
        PSTDIO_DISABLE_API_AUTO_START: "1",
        PSTDIO_DISABLE_EMBED_MANIFEST: "1",
      }),
      stderr: "pipe",
      stdout: "pipe",
    });

    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);

    expect(output.exitCode).toBe(0);
    expect(stdout).toContain("Ticket shorthand");
    expect(stdout).toContain("id: project.tickets.syncTickets");
    expect(stdout).toContain("extension: project.tickets");
    expect(stdout).toContain("example: pstdio tickets sync --id PS-1");
    expect(stderr).toBe("");
  });

  test("shows extension-aware error for duplicate paths under static namespaces", () => {
    const projectRoot = createProject();
    writeExtension(
      projectRoot,
      "extension-a",
      `export default {
        id: "extension-a",
        name: "Extension A",
        commands: {
          inspectA: {
            title: "Inspect A",
            cli: {
              path: "tickets inspect",
              description: "Inspect A",
            },
            run() {},
          },
        },
      };`,
    );
    writeExtension(
      projectRoot,
      "extension-b",
      `export default {
        id: "extension-b",
        name: "Extension B",
        commands: {
          inspectB: {
            title: "Inspect B",
            cli: {
              path: "tickets inspect",
              description: "Inspect B",
            },
            run() {},
          },
        },
      };`,
    );

    const output = Bun.spawnSync({
      cmd: ["bun", cliEntrypoint, "tickets", "inspect"],
      cwd: projectRoot,
      env: createCliEnv({ PSTDIO_DISABLE_EMBED_MANIFEST: "1" }),
      stderr: "pipe",
      stdout: "pipe",
    });

    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);

    expect(output.exitCode).toBe(1);
    expect(stderr).toContain(
      'Extension command "tickets inspect" is unavailable because it is defined by multiple extensions.',
    );
    expect(stderr).toContain("Extensions: extension-a, extension-b");
    expect(stderr).toContain("Command ids: extension-a.inspectA, extension-b.inspectB");
    expect(stderr).toContain("pstdio extensions check");
    expect(stdout).toBe("");
  });

  test("shows missing-provider recovery when a hinted first-party command is disabled", async () => {
    const projectRoot = createProject();
    const apiUrl = createApiServer((request) => {
      const url = new URL(request.url);
      if (url.pathname === "/healthz") {
        return jsonResponse({ ok: true });
      }

      return jsonResponse(
        {
          error:
            'Command "tickets pull" is unavailable because no enabled extension provides it. It is normally provided by "pstdio.planner". Extension "pstdio.planner" is disabled for this project. Run "pstdio extensions check" for details.',
        },
        { status: 400 },
      );
    });

    const output = await runCli({
      cmd: ["bun", cliEntrypoint, "tickets", "pull"],
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
    expect(output.stderr).toContain('It is normally provided by "pstdio.planner".');
    expect(output.stderr).toContain('Extension "pstdio.planner" is disabled for this project.');
    expect(output.stderr).toContain("pstdio extensions check");
    expect(output.stderr).not.toContain("Unknown argument");
    expect(output.stdout).toBe("");
  });

  test("does not load extension runtime for known static commands in hinted namespaces", () => {
    const projectRoot = createProject();
    const sideEffectFile = "known-static-side-effect.txt";
    writeExtension(
      projectRoot,
      "extension-lab",
      `import { writeFileSync } from "node:fs";
writeFileSync("${sideEffectFile}", "loaded\n");

export default {
  id: "extension-lab",
  name: "Extension Lab",
  commands: {
    inspect: {
      title: "Inspect",
      cli: {
        path: "extension-lab inspect",
        description: "Inspect extension lab",
      },
      run() {},
    },
  },
};`,
    );

    const output = Bun.spawnSync({
      cmd: ["bun", cliEntrypoint, "workspaces", "list", "--help"],
      cwd: projectRoot,
      env: createCliEnv({
        PSTDIO_DISABLE_API_AUTO_START: "1",
        PSTDIO_DISABLE_EMBED_MANIFEST: "1",
      }),
      stderr: "pipe",
      stdout: "pipe",
    });

    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);

    expect(output.exitCode).toBe(0);
    expect(stdout).toContain("List active workspaces");
    expect(stderr).toBe("");
    expect(existsSync(join(projectRoot, sideEffectFile))).toBe(false);
  });
});
