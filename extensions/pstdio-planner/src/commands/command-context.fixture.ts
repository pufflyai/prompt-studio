import { resolve } from "node:path";
import { type CommandContextInput, makeCommandContext as makeContext } from "@pstdio/sdk/testing";

export { commandParamsFor } from "@pstdio/sdk/testing";
export const defaultProjectRoot = resolve("/repo");
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
      settings: { get: async () => true, all: async () => ({ "automation.maxInProgress": 2 }) },
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      ...input.overrides,
      workspaces: {
        ...makeContext(input).workspaces,
        getDefault: async () => ({
          id: "default",
          project_id: projectId,
          root_path: defaultProjectRoot,
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

export const createSessionResource = () => ({
  type: "session" as const,
  id: "session-1",
  title: "Session",
  status: "in_progress" as const,
});
