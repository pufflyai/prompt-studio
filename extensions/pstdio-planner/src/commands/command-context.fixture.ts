import { resolve } from "node:path";
import { type CommandContextInput, makeCommandContext as makeContext } from "@pstdio/sdk/testing";
import { ticketContext } from "../data/ticket-context.fixture";

export { commandParamsFor } from "@pstdio/sdk/testing";
export const defaultProjectRoot = resolve("/repo");
export const makeCommandContext = <TParams extends Record<string, unknown>>(input: CommandContextInput<TParams>) => {
  const projectId = input.projectId ?? "proj-1";
  return makeContext({
    ...input,
    resourcePrefixes: { ticket: input.overrides?.project?.shorthand ?? "T", report: "RP" },
    overrides: {
      extensionId: "pstdio-planner",
      resources: {
        ...ticketContext(input.storage).resources,
        allocate: makeContext({
          ...input,
          resourcePrefixes: { ticket: input.overrides?.project?.shorthand ?? "T", report: "RP" },
          overrides: { ...input.overrides, extensionId: "pstdio-planner" },
        }).resources.allocate,
      },
      process: {
        run: async () => ({ exitCode: 0, stdout: "main-sha\n", stderr: "" }),
        runOrThrow: async () => ({ exitCode: 0, stdout: "main-sha\n", stderr: "" }),
      },
      packageFiles: {
        readText: async () =>
          "{{ticket}} {{workspaceId}} {{templateName}} {{additionalContext}} {{reviewId}} {{revision}} {{headSha}}",
      },
      views: { list: async () => ({ views: [], defaultViewId: "default" }) },
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      ...input.overrides,
      settings: {
        get: async () => true,
        all: async () => ({
          "automation.maxInProgress": 2,
          "workflow.statuses": {
            completedStatusIds: ["done"],
            blockedStatusIds: ["blocked"],
            activeStatusIds: ["in-progress", "in-review"],
            mergeTargetStatusId: "done",
          },
        }),
        ...input.overrides?.settings,
      },
      sessions: { ...makeContext(input).sessions, ...input.overrides?.sessions },
      workspaces: {
        ...makeContext(input).workspaces,
        list: async () => [],
        get: async (id) => ({
          id,
          root_path: defaultProjectRoot,
          execution_kind: "local",
          provider_capabilities_json: {
            files: "write",
            diff: true,
            merge: true,
            rebase: true,
            archive: true,
            delete: true,
          },
        }),
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
