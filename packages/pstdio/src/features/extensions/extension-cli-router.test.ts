import { describe, expect, mock, test } from "bun:test";
import type { CommandExecuteResponse, ExtensionCommandRecord } from "@pstdio/sdk/api";
import {
  buildExtensionCommandTable,
  dispatchExtensionCliCommand,
  formatMissingCommandRecovery,
  parseExtensionCommandArgs,
  renderCommandHelp,
  renderNamespaceHelp,
} from "./extension-cli-router";

const labCommands: ExtensionCommandRecord[] = [
  {
    id: "lab.counter.bump",
    extensionId: "pstdio.extension-lab",
    title: "Bump lab counter",
    description: "Increment the lab counter.",
    cliPath: "lab counter bump",
    params: { amount: { type: "number", defaultValue: 1 } },
    examples: ["pstdio lab counter bump --amount 2"],
  },
  {
    id: "lab.counter.read",
    extensionId: "pstdio.extension-lab",
    title: "Read lab counter",
    cliPath: "lab counter read",
  },
];

const successResponse: CommandExecuteResponse = {
  commandId: "lab.counter.bump",
  extensionId: "pstdio.extension-lab",
  outcome: { ok: true, status: "success", value: { counter: 2 } },
};

describe("extension CLI router", () => {
  test("builds namespace and command help from command metadata", () => {
    const table = buildExtensionCommandTable(labCommands);

    expect(table.collisions).toEqual([]);
    expect(renderNamespaceHelp("lab", table)).toContain("lab counter bump");
    expect(renderNamespaceHelp("lab", table)).toContain("pstdio.extension-lab");
    expect(renderCommandHelp(labCommands[0]!)).toContain("--amount");
    expect(renderCommandHelp(labCommands[0]!)).toContain("lab.counter.bump");
  });

  test("detects CLI path collisions without picking a provider", () => {
    const table = buildExtensionCommandTable([
      labCommands[0]!,
      {
        id: "other.counter.bump",
        extensionId: "pstdio.other",
        title: "Other bump",
        cliPath: "lab counter bump",
      },
    ]);

    expect(table.collisions).toHaveLength(1);
    expect(table.collisions[0]?.commands.map((command) => command.id)).toEqual([
      "lab.counter.bump",
      "other.counter.bump",
    ]);
  });

  test("parses params from command option descriptors", () => {
    const parsed = parseExtensionCommandArgs(labCommands[0]!, ["--amount", "2"]);

    expect(parsed.params).toEqual({ amount: 2 });
    expect(parsed.help).toBe(false);
  });

  test("dispatches a namespace command through the API client with repo context", async () => {
    const execute = mock(async (_commandId: string, _request: unknown) => successResponse);
    const listCommands = mock(async () => ({ commands: labCommands, diagnostics: [] }));
    const log = mock();

    const exitCode = await dispatchExtensionCliCommand({
      rawArgs: ["lab", "counter", "bump", "--amount", "2"],
      deps: {
        cwd: () => "/repo",
        execute,
        listCommands,
        listRepos: async () => [
          {
            id: "repo-1",
            name: "repo",
            path: "/repo",
            display_name: null,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        log,
        resolveProjectId: () => ({ projectId: "project-1", root: "/repo" }),
      },
    });

    expect(exitCode).toBe(0);
    expect(execute).toHaveBeenCalledWith("lab.counter.bump", {
      projectId: "project-1",
      params: { amount: 2 },
      repo: { projectId: "project-1", repoId: "repo-1", path: "/repo" },
      source: "cli",
    });
    expect(log).toHaveBeenCalledWith('{"counter":2}');
  });

  test("prints missing-command recovery when a known path has moved to an extension", () => {
    expect(formatMissingCommandRecovery(["planner", "tickets", "pull"])).toContain("pstdio.planner");
  });

  test("ignores unknown root commands outside extension namespaces", async () => {
    const error = mock();

    const exitCode = await dispatchExtensionCliCommand({
      rawArgs: ["unknown"],
      deps: {
        error,
        execute: mock(async () => successResponse),
        listCommands: mock(async () => ({ commands: labCommands, diagnostics: [] })),
        listRepos: mock(async () => []),
        resolveProjectId: () => ({ projectId: "project-1", root: "/repo" }),
      },
    });

    expect(exitCode).toBe(null);
    expect(error).not.toHaveBeenCalled();
  });
});
