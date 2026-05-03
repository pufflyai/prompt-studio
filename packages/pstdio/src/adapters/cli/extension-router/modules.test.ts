import { describe, expect, mock, test } from "bun:test";
import type { CommandOutcome } from "@pstdio/sdk/extensions";
import type { CliHelpNode, RuntimeCommandRecord } from "pstdio-extensions";
import yargs from "yargs";
import type { ExtensionCommandDeps } from "./dispatch";
import { buildExtensionCommandModules, createCommandLookup } from "./modules";

const buildDeps = (overrides: Partial<ExtensionCommandDeps> = {}): ExtensionCommandDeps => ({
  cwd: () => "/tmp/repo",
  resolveProjectId: () => ({ projectId: "p1", root: "/tmp/repo" }),
  execute: mock(async (_id: string, _body: unknown) => ({
    outcome: { ok: true, status: "success", value: { ok: true } } as CommandOutcome,
  })),
  log: mock(),
  err: mock(),
  exit: mock(),
  ...overrides,
});

const tree: CliHelpNode[] = [
  {
    segment: "lab",
    pathKey: "lab",
    children: [
      {
        segment: "counter",
        pathKey: "lab counter",
        children: [
          {
            segment: "bump",
            pathKey: "lab counter bump",
            children: [],
            command: {
              extensionId: "pstdio.extension-lab",
              commandId: "lab.counter.bump",
              namespace: "lab",
              path: ["counter", "bump"],
              pathKey: "lab counter bump",
              description: "Bump the lab counter",
              examples: ["pstdio lab counter bump --amount 2"],
            },
          },
        ],
      },
    ],
  },
];

const records: RuntimeCommandRecord[] = [
  {
    id: "lab.counter.bump",
    localId: "counter.bump",
    extensionId: "pstdio.extension-lab",
    namespace: "lab",
    sourcePath: "/fake/lab/extension.ts",
    title: "Bump counter",
    description: "Bumps the lab counter",
    params: {},
    commandPanel: {},
    menus: [],
    cli: undefined,
    run: async () => undefined,
  },
];

describe("buildExtensionCommandModules", () => {
  test("dispatches the matched commandId with extracted params", async () => {
    const execute = mock(async () => ({
      outcome: { ok: true, status: "success", value: { counter: 3 } } as CommandOutcome,
    }));
    const deps = buildDeps({ execute });
    const modules = buildExtensionCommandModules({
      deps,
      tree,
      commandLookup: createCommandLookup(records),
    });

    const cli = yargs(["lab", "counter", "bump", "--amount", "2"]);
    for (const mod of modules) cli.command(mod);
    await cli.parseAsync();

    expect(execute).toHaveBeenCalledTimes(1);
    const call = execute.mock.calls[0] as unknown as [string, { params: { amount: unknown } }];
    expect(call[0]).toBe("lab.counter.bump");
    expect(call[1].params.amount).toBe(2);
  });

  test("prints success outcome and does not call exit with non-zero code", async () => {
    const log = mock();
    const exit = mock();
    const deps = buildDeps({ log, exit });
    const modules = buildExtensionCommandModules({
      deps,
      tree,
      commandLookup: createCommandLookup(records),
    });

    const cli = yargs(["lab", "counter", "bump"]);
    for (const mod of modules) cli.command(mod);
    await cli.parseAsync();

    expect(log).toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  test("rejected outcomes exit with non-zero status", async () => {
    const exit = mock();
    const deps = buildDeps({
      execute: mock(async () => ({
        outcome: { ok: false, status: "rejected", reason: "no" } as CommandOutcome,
      })),
      exit,
    });
    const modules = buildExtensionCommandModules({
      deps,
      tree,
      commandLookup: createCommandLookup(records),
    });

    const cli = yargs(["lab", "counter", "bump"]);
    for (const mod of modules) cli.command(mod);
    await cli.parseAsync();

    expect(exit).toHaveBeenCalledWith(1);
  });

  test("refuses to run colliding paths", async () => {
    const execute = mock();
    const err = mock();
    const exit = mock();
    const deps = buildDeps({ execute, err, exit });
    const modules = buildExtensionCommandModules({
      deps,
      tree,
      commandLookup: createCommandLookup(records),
      refusedPathKeys: new Set(["lab counter bump"]),
    });

    const cli = yargs(["lab", "counter", "bump"]);
    for (const mod of modules) cli.command(mod);
    await cli.parseAsync();

    expect(execute).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });

  const captureHelp = async (args: string[]) => {
    const deps = buildDeps();
    const modules = buildExtensionCommandModules({
      deps,
      tree,
      commandLookup: createCommandLookup(records),
    });

    const cli = yargs(args).scriptName("pstdio").exitProcess(false).fail(false);
    for (const mod of modules) cli.command(mod);

    return new Promise<string>((resolve) => {
      cli.parse(args, (_err: unknown, _argv: unknown, output: unknown) => {
        resolve(typeof output === "string" ? output : "");
      });
    });
  };

  test("namespace help mentions provider and extension namespace", async () => {
    const text = await captureHelp(["lab", "--help"]);
    expect(text).toContain("Extension namespace: lab");
    expect(text).toContain("Provider: pstdio.extension-lab");
  });

  test("command help epilog includes provider and command id", async () => {
    const text = await captureHelp(["lab", "counter", "bump", "--help"]);
    expect(text).toContain("pstdio.extension-lab");
    expect(text).toContain("lab.counter.bump");
    expect(text).toContain("pstdio lab counter bump --amount 2");
  });

  const expectMissingSubcommand = async (args: string[], expectedPath: string) => {
    const deps = buildDeps();
    const modules = buildExtensionCommandModules({
      deps,
      tree,
      commandLookup: createCommandLookup(records),
    });

    const captured = { msg: "" };
    const cli = yargs(args).scriptName("pstdio").exitProcess(false);
    cli.fail((msg) => {
      captured.msg = msg;
    });
    for (const mod of modules) cli.command(mod);

    await cli.parseAsync().catch(() => {
      /* fail handler captures the message */
    });

    expect(captured.msg).toContain(`Missing subcommand for "pstdio ${expectedPath}"`);
  };

  test("invoking a branch without a subcommand reports the missing path", async () => {
    await expectMissingSubcommand(["lab", "counter"], "lab counter");
  });

  test("invoking a namespace without a subcommand reports the missing path", async () => {
    await expectMissingSubcommand(["lab"], "lab");
  });
});
