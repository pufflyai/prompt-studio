import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, createExtensionStorageDBService, createProjectsDBService } from "pstdio-db";

const cliEntrypoint = fileURLToPath(new URL("../../../index.ts", import.meta.url));

let tempDirs: string[] = [];

const createCliEnv = (overrides: NodeJS.ProcessEnv = {}) => {
  const env = { ...process.env, ...overrides };
  delete env.FORCE_COLOR;
  delete env.NO_COLOR;
  return env;
};

const createProject = async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-command-execution-"));
  tempDirs.push(projectRoot);
  const dbPath = join(projectRoot, "db");
  const connection = await createDb({ path: dbPath });
  const project = await createProjectsDBService(connection.db).create({ name: "extension-cli" });
  await connection.close();

  mkdirSync(join(projectRoot, ".git"), { recursive: true });
  mkdirSync(join(projectRoot, ".pstdio"), { recursive: true });
  writeFileSync(join(projectRoot, ".pstdio", "config.json"), `${JSON.stringify({ project_id: project.id })}\n`);

  return { projectRoot, dbPath, projectId: project.id };
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

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("extension command execution from the real CLI", () => {
  test("runs a local extension command and persists command storage", async () => {
    const { projectRoot, dbPath, projectId } = await createProject();
    writeExtension(projectRoot);

    const output = Bun.spawnSync({
      cmd: ["bun", cliEntrypoint, "extension-lab", "inspect", "--note", "hello", "--count", "2", "--verbose"],
      cwd: projectRoot,
      env: createCliEnv({
        PSTDIO_DB_PATH: dbPath,
        PSTDIO_DISABLE_API_AUTO_START: "1",
        PSTDIO_DISABLE_EMBED_MANIFEST: "1",
      }),
      stderr: "pipe",
      stdout: "pipe",
    });

    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);

    expect(output.exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).not.toContain("[createDb]");
    expect(stdout).toContain(`"projectId": "${projectId}"`);
    expect(stdout).toContain('"targetType": "project"');
    expect(stdout).toContain('"note": "hello"');
    expect(stdout).toContain('"count": 2');
    expect(stdout).toContain('"verbose": true');

    const connection = await createDb({ path: dbPath });
    const storage = createExtensionStorageDBService(connection.db);
    expect(
      await storage.get(
        {
          project_id: projectId,
          extension_id: "project.extension-lab",
          scope_type: "project",
          scope_id: "",
        },
        "lastCliRun",
      ),
    ).toEqual({
      projectId,
      target: { type: "project", id: projectId, projectId },
      params: {
        note: "hello",
        count: 2,
        verbose: true,
      },
    });
    await connection.close();
  });

  test("rejects non-project targets until the CLI provides a target resolver", async () => {
    const { projectRoot, dbPath } = await createProject();
    writeWorkspaceTargetExtension(projectRoot);

    const output = Bun.spawnSync({
      cmd: ["bun", cliEntrypoint, "extension-lab", "inspect-workspace"],
      cwd: projectRoot,
      env: createCliEnv({
        PSTDIO_DB_PATH: dbPath,
        PSTDIO_DISABLE_API_AUTO_START: "1",
        PSTDIO_DISABLE_EMBED_MANIFEST: "1",
      }),
      stderr: "pipe",
      stdout: "pipe",
    });

    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);

    expect(output.exitCode).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toContain('targets "workspace"');
    expect(stderr).toContain("requires an explicit workspace target");
  });
});
