import { type CommandContextInput, makeCommandContext as makeContext } from "@pstdio/sdk/testing";

export { commandParamsFor } from "@pstdio/sdk/testing";
export const makeCommandContext = <TParams extends Record<string, unknown>>(input: CommandContextInput<TParams>) => {
  const projectId = input.projectId ?? "proj-1";
  return makeContext({
    ...input,
    resourcePrefixes: { ticket: input.overrides?.project?.shorthand ?? "T", report: "RP" },
    overrides: {
      extensionId: "pstdio-planner",
      repos: {
        list: async () => [{ projectId, repoId: "repo-1", path: "/repo", role: "default" }],
        get: async () => ({ projectId, repoId: "repo-1", path: "/repo", role: "default" }),
        getDefault: async () => ({ projectId, repoId: "repo-1", path: "/repo", role: "default" }),
      },
      process: {
        run: async () => ({ exitCode: 0, stdout: "main-sha\n", stderr: "" }),
        runOrThrow: async () => ({ exitCode: 0, stdout: "main-sha\n", stderr: "" }),
      },
      packageFiles: {
        readText: async () =>
          "{{ticket}} {{workspaceId}} {{templateName}} {{additionalContext}} {{reviewId}} {{revision}} {{headSha}}",
      },
      settings: { all: async () => ({ "automation.maxInProgress": 2 }) },
      ...input.overrides,
    },
  });
};
export const makeCommandArgs = <TParams extends Record<string, unknown>>(input: CommandContextInput<TParams>) =>
  [makeCommandContext(input), input.params] as const;
