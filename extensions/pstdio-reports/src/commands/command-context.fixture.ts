import { type CommandContextInput, makeCommandContext as makeContext } from "@pstdio/sdk/testing";

export { commandParamsFor } from "@pstdio/sdk/testing";
export const makeCommandContext = <TParams extends Record<string, unknown>>(input: CommandContextInput<TParams>) => {
  return makeContext({
    ...input,
    resourcePrefixes: { ticket: input.overrides?.project?.shorthand ?? "T", report: "RP" },
    overrides: {
      extensionId: "pstdio-reports",
      packageFiles: { readText: async () => "## Confidence Score\n" },
      ...input.overrides,
    },
  });
};
export const makeCommandArgs = <TParams extends Record<string, unknown>>(input: CommandContextInput<TParams>) =>
  [makeCommandContext(input), input.params] as const;
