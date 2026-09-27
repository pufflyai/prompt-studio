import { resolve } from "node:path";
import { type CommandContextInput, makeCommandContext as makeContext } from "@pstdio/sdk/testing";

export { commandParamsFor } from "@pstdio/sdk/testing";
export const defaultProjectRoot = resolve("/repo");
export const makeCommandContext = <TParams extends Record<string, unknown>>(input: CommandContextInput<TParams>) => {
  return makeContext({
    ...input,
    resourcePrefixes: { ticket: input.overrides?.project?.shorthand ?? "T", report: "RP" },
    overrides: {
      extensionId: "pstdio-reports",
      packageFiles: { readText: async () => "## Confidence Score\n" },
      ...input.overrides,
      workspaces: {
        ...makeContext(input).workspaces,
        getByShorthand: async () => null,
        getDefault: async () => ({
          id: "home",
          workspace_shorthand: "WS-1",
          execution_kind: "local",
          root_path: defaultProjectRoot,
        }),
        ...input.overrides?.workspaces,
      },
    },
  });
};
export const makeCommandArgs = <TParams extends Record<string, unknown>>(input: CommandContextInput<TParams>) =>
  [makeCommandContext(input), input.params] as const;
