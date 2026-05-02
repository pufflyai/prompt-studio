import { describe, expect, mock, test } from "bun:test";
import type { CommandOutcome } from "@pstdio/sdk/extensions";
import type { CliHelpNode } from "pstdio-extensions";
import yargs from "yargs";
import { buildExtensionCommandModules, type ExtensionCommandDeps } from "./extension-commands";

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
              extensionId: "pstdio.lab",
              commandId: "lab.counter.bump",
              namespace: "lab",
              path: ["counter", "bump"],
              pathKey: "lab counter bump",
            },
          },
        ],
      },
    ],
  },
];

describe("buildExtensionCommandModules", () => {
  test("dispatches the matched commandId with extracted params", async () => {
    const execute = mock(async () => ({
      outcome: { ok: true, status: "success", value: { counter: 3 } } as CommandOutcome,
    }));
    const deps = buildDeps({ execute });
    const modules = buildExtensionCommandModules(deps, tree);

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
    const modules = buildExtensionCommandModules(deps, tree);

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
    const modules = buildExtensionCommandModules(deps, tree);

    const cli = yargs(["lab", "counter", "bump"]);
    for (const mod of modules) cli.command(mod);
    await cli.parseAsync();

    expect(exit).toHaveBeenCalledWith(1);
  });
});
