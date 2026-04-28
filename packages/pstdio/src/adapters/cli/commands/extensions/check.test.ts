import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadExtensionRuntime } from "pstdio-extensions";
import type { Arguments } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
import { createHandler, formatExtensionsCheckOutput } from "./check";

const argv = () => ({ _: [], $0: "" }) as Arguments;

const emptyRuntime = {
  extensions: [],
  commands: [],
  cli: [],
  events: [],
  artifactMounts: [],
  templateTypes: [],
  templates: [],
  skills: [],
  harnesses: [],
  diagnostics: [],
};

let tempDirs: string[] = [];

const createProject = () => {
  const projectRoot = mkdtempSync(join(tmpdir(), "pstdio-extensions-check-"));
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

const createRuntimeBackedHandler = (projectRoot: string) => {
  const log = mock<(msg: string) => void>();
  const setExitCode = mock<(code: number) => void>();

  return {
    log,
    setExitCode,
    handler: createHandler({
      cwd: () => projectRoot,
      findGitRoot,
      readConfig,
      loadExtensionRuntime,
      log,
      setExitCode,
    }),
  };
};

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("extensions check formatting", () => {
  test("prints an empty successful report when extensions are missing", async () => {
    const log = mock();
    const setExitCode = mock();
    const loadExtensionRuntime = mock(async () => emptyRuntime);
    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      loadExtensionRuntime,
      log,
      setExitCode,
    });

    await handler(argv());

    const output = log.mock.calls[0]?.[0] as string;
    expect(output).toContain("Project root: /repo");
    expect(output).toContain("No extensions loaded.");
    expect(output).toContain("No command ids registered.");
    expect(output).toContain("No CLI paths registered.");
    expect(output).toContain("No event handlers registered.");
    expect(output).toContain("No artifact mounts registered.");
    expect(output).toContain("No harness providers registered.");
    expect(output).toContain("No diagnostics.");
    expect(loadExtensionRuntime).toHaveBeenCalledWith({ projectRoot: "/repo" });
    expect(setExitCode).not.toHaveBeenCalled();
  });

  test("prints loaded extension entries and diagnostics details", () => {
    const output = formatExtensionsCheckOutput({
      projectRoot: "/repo",
      runtime: {
        ...emptyRuntime,
        extensions: [
          {
            id: "project.review",
            displayName: "Project Review",
            sourceKind: "local",
            sourcePath: "/repo/.pstdio/extensions/project.review/extension.ts",
            definition: { id: "project.review", name: "Project Review" },
          },
        ],
        commands: [
          {
            id: "project.review.run",
            key: "run",
            extensionId: "project.review",
            title: "Run",
            run: async () => {},
            menus: [],
            sourcePath: "/repo/.pstdio/extensions/project.review/extension.ts",
          },
        ],
        cli: [
          {
            path: "workspace review",
            pathSegments: ["workspace", "review"],
            examples: [],
            commandId: "project.review.run",
            extensionId: "project.review",
          },
        ],
        events: [
          {
            id: "project.review.reviewCompleted",
            key: "reviewCompleted",
            extensionId: "project.review",
            event: "project.review.completed",
            eventId: "project.review.completed",
            sourcePath: "/repo/.pstdio/extensions/project.review/extension.ts",
            handler: async () => {},
          },
        ],
        artifactMounts: [
          {
            id: "project.review.tickets",
            key: "tickets",
            extensionId: "project.review",
            path: ".pstdio/tickets",
            label: "Tickets",
            sourcePath: "/repo/.pstdio/extensions/project.review/extension.ts",
          },
        ],
        harnesses: [
          {
            id: "project.review.fake",
            key: "fake",
            extensionId: "project.review",
            label: "Fake Harness",
            start: async () => ({ runId: "run-1" }),
          },
        ],
        diagnostics: [
          {
            severity: "error",
            code: "duplicate_cli_path",
            message: 'CLI path "workspace review" is already provided',
            extensionId: "project.review",
            sourcePath: "/repo/.pstdio/extensions/project.review/extension.ts",
            related: [{ commandId: "project.review.run", path: "workspace review", sourcePath: "/repo/one.ts" }],
          },
        ],
      },
    });

    expect(output).toContain("project.review");
    expect(output).toContain("/repo/.pstdio/extensions/project.review/extension.ts");
    expect(output).toContain("project.review.run");
    expect(output).toContain("workspace review");
    expect(output).toContain("project.review.completed");
    expect(output).toContain(".pstdio/tickets");
    expect(output).toContain("project.review.fake");
    expect(output).toContain("Fake Harness");
    expect(output).toContain("[error] duplicate_cli_path");
    expect(output).toContain("related:");
    expect(output).toContain("command=project.review.run");
  });

  test("sets exit code to 1 when runtime reports error diagnostics", async () => {
    const setExitCode = mock();
    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      loadExtensionRuntime: async () => ({
        ...emptyRuntime,
        diagnostics: [
          {
            severity: "warning",
            code: "invalid_export",
            message: "warning",
          },
          {
            severity: "error",
            code: "invalid_extension_id",
            message: "error",
          },
        ],
      }),
      log: mock(),
      setExitCode,
    });

    await handler(argv());

    expect(setExitCode).toHaveBeenCalledWith(1);
  });

  test("prints invalid export, duplicate id, duplicate cli path, and unsafe mount diagnostics", () => {
    const output = formatExtensionsCheckOutput({
      projectRoot: "/repo",
      runtime: {
        ...emptyRuntime,
        diagnostics: [
          {
            severity: "error",
            code: "invalid_export",
            message: "Module does not export a default extension definition",
            sourcePath: "/repo/.pstdio/extensions/a/extension.ts",
          },
          {
            severity: "error",
            code: "duplicate_extension_id",
            message: 'Extension id "project.duplicates" is already provided',
            extensionId: "project.duplicates",
            sourcePath: "/repo/.pstdio/extensions/b/extension.ts",
            related: [
              {
                extensionId: "project.duplicates",
                sourcePath: "/repo/.pstdio/extensions/a/extension.ts",
              },
            ],
          },
          {
            severity: "error",
            code: "duplicate_cli_path",
            message: 'CLI path "tickets pull" is already provided',
            extensionId: "project.duplicates",
            sourcePath: "/repo/.pstdio/extensions/b/extension.ts",
            related: [{ commandId: "project.duplicates.run", path: "tickets pull" }],
          },
          {
            severity: "error",
            code: "unsafe_artifact_mount_path",
            message: 'Artifact mount "unsafe" must stay under .pstdio',
            extensionId: "project.duplicates",
            sourcePath: "/repo/.pstdio/extensions/a/extension.ts",
            related: [{ path: "../secrets" }],
          },
        ],
      },
    });

    expect(output).toContain("[error] invalid_export");
    expect(output).toContain("[error] duplicate_extension_id");
    expect(output).toContain("[error] duplicate_cli_path");
    expect(output).toContain("[error] unsafe_artifact_mount_path");
    expect(output).toContain("source=/repo/.pstdio/extensions/a/extension.ts");
    expect(output).toContain("extension=project.duplicates");
    expect(output).toContain("path=../secrets");
  });
});

describe("extensions check runtime integration", () => {
  test("uses the real runtime for an empty project", async () => {
    const projectRoot = createProject();
    const { handler, log, setExitCode } = createRuntimeBackedHandler(projectRoot);

    await handler(argv());

    const output = log.mock.calls[0]?.[0] as string;
    expect(output).toContain(`Project root: ${projectRoot}`);
    expect(output).toContain("pstdio.planner");
    expect(output).toContain("No diagnostics.");
    expect(setExitCode).not.toHaveBeenCalled();
  });

  test("uses the real runtime for a valid local extension project", async () => {
    const projectRoot = createProject();
    writeExtension(
      projectRoot,
      "project.review",
      `export default {
        id: "project.review",
        name: "Project Review",
        commands: {
          run: {
            title: "Run",
            cli: { path: "workspace review" },
            run() {},
          },
        },
        artifactMounts: {
          tickets: { path: ".pstdio/tickets", label: "Tickets" },
        },
        harnesses: {
          fake: {
            label: "Fake Harness",
            async start() {
              return { runId: "fake" };
            },
          },
        },
      };`,
    );
    const { handler, log, setExitCode } = createRuntimeBackedHandler(projectRoot);

    await handler(argv());

    const output = log.mock.calls[0]?.[0] as string;
    expect(output).toContain("project.review");
    expect(output).toContain(`${projectRoot}/.pstdio/extensions/project.review/extension.ts`);
    expect(output).toContain("project.review.run");
    expect(output).toContain("workspace review");
    expect(output).toContain(".pstdio/tickets");
    expect(output).toContain("project.review.fake");
    expect(output).toContain("No diagnostics.");
    expect(setExitCode).not.toHaveBeenCalled();
  });

  test("uses the real runtime for invalid local extension projects", async () => {
    const projectRoot = createProject();
    writeExtension(projectRoot, "missing-default", `export const value = 1;`);
    writeExtension(
      projectRoot,
      "duplicate-a",
      `export default {
        id: "project.duplicates",
        name: "Duplicates A",
        commands: {
          run: {
            title: "Run",
            cli: { path: "tickets pull" },
            run() {},
          },
        },
        artifactMounts: {
          unsafe: { path: "../secrets", label: "Secrets" },
        },
      };`,
    );
    writeExtension(
      projectRoot,
      "duplicate-b",
      `export default {
        id: "project.duplicates",
        name: "Duplicates B",
        commands: {
          run: {
            title: "Run again",
            cli: { path: "tickets pull" },
            run() {},
          },
        },
      };`,
    );
    const { handler, log, setExitCode } = createRuntimeBackedHandler(projectRoot);

    await handler(argv());

    const output = log.mock.calls[0]?.[0] as string;
    expect(output).toContain("[error] invalid_export");
    expect(output).toContain("[error] duplicate_extension_id");
    expect(output).toContain("[error] duplicate_cli_path");
    expect(output).toContain("[error] unsafe_artifact_mount_path");
    expect(output).toContain(`${projectRoot}/.pstdio/extensions/duplicate-a/extension.ts`);
    expect(output).toContain(`${projectRoot}/.pstdio/extensions/duplicate-b/extension.ts`);
    expect(setExitCode).toHaveBeenCalledWith(1);
  });
});

describe("extensions check project resolution", () => {
  test("throws when no project root or project config can be resolved", async () => {
    const handler = createHandler({
      cwd: () => "/outside",
      findGitRoot: () => null,
      readConfig: () => null,
      loadExtensionRuntime: async () => emptyRuntime,
      log: mock(),
      setExitCode: mock(),
    });

    await expect(handler(argv())).rejects.toThrow(
      "No project specified. Run inside a linked project with .pstdio/config.json.",
    );
  });
});
