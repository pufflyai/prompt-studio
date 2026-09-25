import { type CommandContextInput, makeCommandContext as makeContext } from "@pstdio/sdk/testing";

export { commandParamsFor } from "@pstdio/sdk/testing";
export const makeCommandContext = <TParams extends Record<string, unknown>>(input: CommandContextInput<TParams>) => {
  const projectId = input.projectId ?? "proj-1";
  return makeContext({
    ...input,
    resourcePrefixes: { ticket: input.overrides?.project?.shorthand ?? "T", report: "RP" },
    overrides: {
      extensionId: "pstdio-planner",
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
      workspaces: {
        ...makeContext(input).workspaces,
        getDefault: async () => ({
          id: "default",
          project_id: projectId,
          root_path: "/repo",
          provider_id: "pstdio.root",
          execution_kind: "local",
          provider_state: "ready",
        }),
        listProviders: async () => [{ id: "pstdio.worktree", label: "Git worktree", params: {} }],
        ...input.overrides?.workspaces,
      },
    },
  });
};
export const makeCommandArgs = <TParams extends Record<string, unknown>>(input: CommandContextInput<TParams>) =>
  [makeCommandContext(input), input.params] as const;
