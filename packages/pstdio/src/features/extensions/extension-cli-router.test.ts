import { describe, expect, mock, test } from "bun:test";
import type { CommandExecuteResponse, ExtensionCommandRecord } from "@pstdio/sdk/api";
import {
  buildExtensionCommandTable,
  dispatchExtensionCliCommand,
  formatMissingCommandRecovery,
  missingRequiredParams,
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

const workspaceStatusCommands = [
  {
    id: "pstdio-planner.workspaceStatus.set",
    extensionId: "pstdio.pstdio-planner",
    title: "Set workspace status",
    cliPath: "pstdio-planner workspaceStatus set",
    cliAliases: ["workspaces set-status"],
    params: {
      workspace: { type: "text" },
      status: { type: "text" },
    },
  },
] satisfies Array<ExtensionCommandRecord & { cliAliases?: string[] }>;

describe("extension CLI router", () => {
  test("localizes namespace help from extension translations", async () => {
    const previousLcAll = process.env.LC_ALL;
    const previousLang = process.env.LANG;
    process.env.LC_ALL = "fr_FR.UTF-8";
    process.env.LANG = "fr_FR.UTF-8";
    const log = mock();

    try {
      const exitCode = await dispatchExtensionCliCommand({
        rawArgs: ["lab", "--help"],
        deps: {
          execute: mock(async () => successResponse),
          listCommands: mock(async () => ({
            commands: [
              {
                id: "lab.counter.bump",
                extensionId: "pstdio.extension-lab",
                title: { $l10n: "commands.counter.bump.title", default: "Bump lab counter" },
                cliPath: "lab counter bump",
              },
            ],
            translations: [
              {
                extensionId: "pstdio.extension-lab",
                defaultLocale: "en",
                bundles: {
                  en: { "commands.counter.bump.title": "Bump lab counter" },
                  fr: { "commands.counter.bump.title": "Incrémenter le compteur" },
                },
              },
            ],
            diagnostics: [],
          })),
          listRepos: mock(async () => []),
          log,
          resolveProjectId: () => ({ projectId: "project-1", root: "/repo" }),
        },
      });

      expect(exitCode).toBe(0);
      expect(log).toHaveBeenCalledWith(expect.stringContaining("Incrémenter le compteur"));
    } finally {
      if (previousLcAll === undefined) {
        delete process.env.LC_ALL;
      } else {
        process.env.LC_ALL = previousLcAll;
      }
      if (previousLang === undefined) {
        delete process.env.LANG;
      } else {
        process.env.LANG = previousLang;
      }
    }
  });

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

  test("accumulates repeated list flags into an array", () => {
    const command: ExtensionCommandRecord = {
      id: "lab.tag",
      extensionId: "pstdio.extension-lab",
      title: "Tag",
      cliPath: "lab tag",
      params: { tag: { type: "list" }, status: { type: "text" } },
    };

    expect(parseExtensionCommandArgs(command, ["--tag", "a", "--tag", "b", "--status", "ready"]).params).toEqual({
      tag: ["a", "b"],
      status: "ready",
    });
    expect(parseExtensionCommandArgs(command, ["--tag", "solo"]).params).toEqual({ tag: ["solo"] });
  });

  test("renders a command result as JSON", async () => {
    const log = mock();

    const exitCode = await dispatchExtensionCliCommand({
      rawArgs: ["lab", "counter", "read"],
      deps: {
        execute: mock(
          async (): Promise<CommandExecuteResponse> => ({
            commandId: "lab.counter.read",
            extensionId: "pstdio.extension-lab",
            outcome: { ok: true, status: "success", value: [{ shorthand: "T-1", title: "First" }] },
          }),
        ),
        listCommands: mock(async () => ({ commands: labCommands, diagnostics: [] })),
        listRepos: mock(async () => []),
        log,
        resolveProjectId: () => ({ projectId: "project-1", root: "/repo" }),
      },
    });

    expect(exitCode).toBe(0);
    const logged = log.mock.calls.at(-1)?.[0] as string;
    expect(JSON.parse(logged)).toEqual([{ shorthand: "T-1", title: "First" }]);
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
    expect(log).toHaveBeenCalledWith(JSON.stringify({ counter: 2 }));
  });

  test("dispatches extension commands through global CLI aliases", async () => {
    const execute = mock(
      async (_commandId: string, _request: unknown): Promise<CommandExecuteResponse> => ({
        commandId: "pstdio-planner.workspaceStatus.set",
        extensionId: "pstdio.pstdio-planner",
        outcome: { ok: true, status: "success", value: { workspaceId: "workspace-1", status: "review-ready" } },
      }),
    );
    const log = mock();

    const exitCode = await dispatchExtensionCliCommand({
      rawArgs: ["workspaces", "set-status", "--workspace", "PS-1_A1", "--status", "review-ready"],
      deps: {
        execute,
        listCommands: mock(async () => ({ commands: workspaceStatusCommands, diagnostics: [] })),
        listRepos: mock(async () => []),
        log,
        resolveProjectId: () => ({ projectId: "project-1", root: "/repo" }),
      },
    });

    expect(exitCode).toBe(0);
    expect(execute).toHaveBeenCalledWith("pstdio-planner.workspaceStatus.set", {
      projectId: "project-1",
      params: { workspace: "PS-1_A1", status: "review-ready" },
      repo: undefined,
      source: "cli",
    });
    expect(log).toHaveBeenCalledWith(JSON.stringify({ workspaceId: "workspace-1", status: "review-ready" }));
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

  test("rejects a command invocation missing a required option without executing it", async () => {
    const error = mock();
    const execute = mock(async () => successResponse);

    const requiredCommands = [
      {
        id: "pstdio-planner.ticketStatus.create",
        extensionId: "pstdio.pstdio-planner",
        title: "Create ticket status",
        cliPath: "pstdio-planner ticketStatus create",
        cliAliases: ["statuses create"],
        params: { label: { type: "text", required: true }, color: { type: "text" } },
      },
    ] satisfies Array<ExtensionCommandRecord & { cliAliases?: string[] }>;

    const exitCode = await dispatchExtensionCliCommand({
      // Old `--name` flag no longer maps to the renamed `--label`, so label is absent.
      rawArgs: ["statuses", "create", "--name", "Foo", "--color", "gray"],
      deps: {
        error,
        execute,
        listCommands: mock(async () => ({ commands: requiredCommands, diagnostics: [] })),
        listRepos: mock(async () => []),
        resolveProjectId: () => ({ projectId: "project-1", root: "/repo" }),
      },
    });

    expect(exitCode).toBe(1);
    expect(execute).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("--label"));
  });
});

describe("missingRequiredParams", () => {
  test("returns required params that are absent and ignores provided/optional ones", () => {
    const command = {
      id: "x",
      extensionId: "e",
      title: "X",
      params: {
        label: { type: "text", required: true },
        color: { type: "text" },
        status: { type: "text", required: true },
      },
    } satisfies ExtensionCommandRecord;

    expect(missingRequiredParams(command, { status: "ready" })).toEqual(["label"]);
    expect(missingRequiredParams(command, { label: "a", status: "ready" })).toEqual([]);
  });
});
