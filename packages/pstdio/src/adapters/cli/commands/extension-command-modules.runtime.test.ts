import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadExtensionRuntime } from "pstdio-extensions";
import yargs, { type Argv, type CommandModule } from "yargs";
import { createExtensionCommandRegistry } from "./extension-command-modules";

const cliEntrypoint = fileURLToPath(new URL("../../../index.ts", import.meta.url));

const createYargs = () =>
  yargs([])
    .scriptName("pstdio")
    .strict()
    .exitProcess(false)
    .fail((msg) => {
      throw new Error(msg);
    });

const createCliEnv = (overrides: NodeJS.ProcessEnv = {}) => {
  const env = { ...process.env, ...overrides };
  delete env.FORCE_COLOR;
  delete env.NO_COLOR;
  return env;
};

const applyBuilder = async (commandModule: CommandModule, cli: Argv) => {
  const { builder } = commandModule;
  if (!builder) return cli;
  if (typeof builder === "function") return await builder(cli);
  return cli.options(builder);
};

let tempDirs: string[] = [];

const createProject = () => {
  const projectRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-cli-routing-"));
  tempDirs.push(projectRoot);
  mkdirSync(join(projectRoot, ".git"), { recursive: true });
  mkdirSync(join(projectRoot, ".pstdio"), { recursive: true });
  writeFileSync(join(projectRoot, ".pstdio", "config.json"), `${JSON.stringify({ project_id: "proj-1" }, null, 2)}\n`);
  return projectRoot;
};

const writeExtension = (projectRoot: string, extensionDir: string, source: string) => {
  const dir = join(projectRoot, ".pstdio", "extensions", extensionDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "extension.ts"), source);
};

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("runtime-backed extension command routing", () => {
  test("loads local extension CLI metadata into namespace help", async () => {
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

    const runtime = await loadExtensionRuntime({ projectRoot });
    const registry = createExtensionCommandRegistry({
      cli: runtime.cli,
      staticTopLevelCommands: ["tickets", "workspaces"],
    });

    expect(runtime.diagnostics).toEqual([]);
    expect(registry.commandModules).toHaveLength(1);

    const built = await applyBuilder(registry.commandModules[0], createYargs());
    const help = await built.getHelp();
    expect(help).toContain("Inspect extension lab");
    expect(help).toContain("id: extension-lab.inspect");
    expect(help).toContain("extension: extension-lab");
    expect(help).toContain("example: pstdio extension-lab inspect --json");
    expect(help).not.toContain("pstdio pstdio");
  });

  test("shows extension-aware error for duplicate extension paths", () => {
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
              path: "extension-lab inspect",
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
              path: "extension-lab inspect",
              description: "Inspect B",
            },
            run() {},
          },
        },
      };`,
    );

    const output = Bun.spawnSync({
      cmd: ["bun", cliEntrypoint, "extension-lab", "inspect"],
      cwd: projectRoot,
      env: createCliEnv({ PSTDIO_DISABLE_EMBED_MANIFEST: "1" }),
      stderr: "pipe",
      stdout: "pipe",
    });

    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);

    expect(output.exitCode).toBe(1);
    expect(stderr).toContain(
      'Extension command "extension-lab inspect" is unavailable because it is defined by multiple extensions.',
    );
    expect(stderr).toContain("Extensions: extension-a, extension-b");
    expect(stderr).toContain("Command ids: extension-a.inspectA, extension-b.inspectB");
    expect(stderr).toContain("pstdio extensions check");
    expect(stderr).not.toContain("Unknown arguments");
    expect(stdout).toBe("");
  });

  test("shows extension-aware error for duplicate paths with leading global options", () => {
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
              path: "extension-lab inspect",
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
              path: "extension-lab inspect",
              description: "Inspect B",
            },
            run() {},
          },
        },
      };`,
    );

    const output = Bun.spawnSync({
      cmd: ["bun", cliEntrypoint, "--api-port", "5555", "extension-lab", "inspect"],
      cwd: projectRoot,
      env: createCliEnv({ PSTDIO_DISABLE_EMBED_MANIFEST: "1" }),
      stderr: "pipe",
      stdout: "pipe",
    });

    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);

    expect(output.exitCode).toBe(1);
    expect(stderr).toContain(
      'Extension command "extension-lab inspect" is unavailable because it is defined by multiple extensions.',
    );
    expect(stderr).toContain("Extensions: extension-a, extension-b");
    expect(stderr).toContain("Command ids: extension-a.inspectA, extension-b.inspectB");
    expect(stderr).toContain("pstdio extensions check");
    expect(stderr).not.toContain("Unknown arguments");
    expect(stdout).toBe("");
  });

  test("does not load extension runtime for static commands with leading global options", () => {
    const cases = [
      { option: "--api-port", value: "5555" },
      { option: "--dashboard-port", value: "7777" },
    ];

    for (const { option, value } of cases) {
      const projectRoot = createProject();
      const sideEffectFile = `import-side-effect-${option.slice(2)}.txt`;

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
        cmd: ["bun", cliEntrypoint, option, value, "extensions", "--help"],
        cwd: projectRoot,
        env: createCliEnv({ PSTDIO_DISABLE_EMBED_MANIFEST: "1" }),
        stderr: "pipe",
        stdout: "pipe",
      });

      const stdout = new TextDecoder().decode(output.stdout);
      const stderr = new TextDecoder().decode(output.stderr);

      expect(output.exitCode).toBe(0);
      expect(stdout).toContain("Inspect local v2 extensions");
      expect(stderr).toBe("");
      expect(existsSync(join(projectRoot, sideEffectFile))).toBe(false);
    }
  });

  test("shows extension-aware error for unsupported single-segment extension paths", () => {
    const projectRoot = createProject();
    writeExtension(
      projectRoot,
      "extension-lab",
      `export default {
        id: "extension-lab",
        name: "Extension Lab",
        commands: {
          root: {
            title: "Root",
            cli: {
              path: "extension-lab",
              description: "Unsupported root path",
            },
            run() {},
          },
        },
      };`,
    );

    const output = Bun.spawnSync({
      cmd: ["bun", cliEntrypoint, "extension-lab"],
      cwd: projectRoot,
      env: createCliEnv({ PSTDIO_DISABLE_EMBED_MANIFEST: "1" }),
      stderr: "pipe",
      stdout: "pipe",
    });

    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);

    expect(output.exitCode).toBe(1);
    expect(stderr).toContain(
      'Extension command "extension-lab" is unavailable because its path format is not supported.',
    );
    expect(stderr).toContain("Extensions: extension-lab");
    expect(stderr).toContain("Command ids: extension-lab.root");
    expect(stderr).toContain("pstdio extensions check");
    expect(stderr).not.toContain("Unknown argument");
    expect(stdout).toBe("");
  });
});
