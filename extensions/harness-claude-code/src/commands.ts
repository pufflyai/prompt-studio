import type {
  HarnessCommandContext,
  HarnessCommandState,
  HarnessOperation,
  PreparedHarnessOperation,
} from "@pstdio/sdk/extensions";
import { resumeClaudeCodeSession, startClaudeCodeSession } from "./spawn";

export const claudeCommandState = (input: HarnessCommandContext): HarnessCommandState => ({
  slashCommands: true,
  commands: [
    { name: "/plan", description: "Select Claude's native planning permission mode.", argumentHelp: "[task]" },
    { name: "/compact", description: "Compact Claude's native conversation.", argumentHelp: "[instructions]" },
    { name: "/goal", description: "Send a native Claude goal command.", argumentHelp: "[condition]" },
  ],
  modes:
    input.params?.permission_mode === "plan"
      ? [
          {
            id: "planning",
            label: "Planning",
            description: "Claude planning permission mode is selected for the next turn.",
            state: "Next turn",
            actions: [{ id: "default", label: "Leave planning" }],
          },
        ]
      : [],
});
export const prepareClaudeOperation = (
  input: HarnessCommandContext,
  operation: HarnessOperation,
  projectId?: string,
): PreparedHarnessOperation => {
  if (operation.kind === "mode-action") {
    if (operation.modeId !== "planning" || operation.actionId !== "default")
      throw new Error("Unknown Claude mode action.");
    return {
      execution: "control",
      invoke: async () => ({ kind: "completed", params: { permission_mode: "bypassPermissions" } }),
    };
  }
  const plan = /^\/plan(?:\s+([\s\S]*))?$/.exec(operation.text);
  if (plan && !plan[1])
    return { execution: "control", invoke: async () => ({ kind: "completed", params: { permission_mode: "plan" } }) };
  return {
    execution: "exclusive",
    invoke: async ({ events, signal }) => {
      const params = plan ? { ...input.params, permission_mode: "plan" } : input.params;
      const run = {
        nativeCommand: !plan,
        signal,
        ...input,
        params,
        prompt: plan?.[1] ?? operation.text,
        events,
        env: { PSTDIO_SESSION_ID: input.sessionId, ...(projectId ? { PSTDIO_PROJECT_ID: projectId } : {}) },
      };
      const session = input.agentSessionId
        ? resumeClaudeCodeSession({
            ...run,
            agentSessionId: input.agentSessionId,
            messageOffset: events.getMessages().length,
          })
        : await startClaudeCodeSession(run);
      return { kind: "started", session, ...(plan ? { params: { permission_mode: "plan" } } : {}) };
    },
  };
};
