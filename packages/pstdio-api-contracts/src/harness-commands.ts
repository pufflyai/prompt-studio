import { z } from "zod";
import type {
  HarnessApprovalChannel,
  HarnessEventSink,
  HarnessParams,
  HarnessQuestionChannel,
  HarnessSession,
  HarnessWorkspaceContext,
} from "./harness";

export const harnessCommandSchema = z.object({
  name: z.string(),
  description: z.string(),
  argumentHelp: z.string().optional(),
  /** Selecting this command tags the draft instead of inserting command text. */
  composer: z
    .object({
      label: z.string(),
      /** Native mode that can confirm this input after submission. */
      modeId: z.string().optional(),
      /** Native action words that cannot be submitted as an objective through this command. */
      reservedArguments: z.array(z.string()).optional(),
    })
    .optional(),
  /** Native availability or combination limit for the current session. */
  disabledReason: z.string().optional(),
});
export const harnessModeActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** Shared UI icon name. Omit when no icon represents the native action. */
  icon: z.string().optional(),
  /** A single native text argument. This is not a general form language. */
  argument: z.object({ label: z.string(), value: z.string().optional() }).optional(),
});
export const harnessModeSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  state: z.string(),
  /** Provider-owned status presentation; the host must not infer it from command names or prose. */
  indicator: z
    .object({ label: z.string(), tone: z.enum(["neutral", "info", "success", "warning", "error"]) })
    .optional(),
  /** Short native summary displayed in the composer tag. */
  tagText: z.string().optional(),
  /** An advertised native action to invoke when the person closes the tag. */
  closeActionId: z.string().optional(),
  /** An explicit native decision that takes over the composer. */
  confirmation: z
    .object({
      /** Native revision identity. Pass it as the advertised action's argument. */
      id: z.string(),
      title: z.string(),
      actionId: z.string(),
      cancelLabel: z.string().optional(),
      /** Model reported by the native provider for this decision. Omit when unknown. */
      model: z.string().optional(),
    })
    .optional(),
  actions: z.array(harnessModeActionSchema),
});
export const harnessCommandStateSchema = z.object({
  commands: z.array(harnessCommandSchema),
  modes: z.array(harnessModeSchema),
  /** Whether input beginning with a slash name is a native command. */
  slashCommands: z.boolean(),
});
export const harnessOperationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("command"), text: z.string().min(1) }).strict(),
  z
    .object({
      kind: z.literal("mode-action"),
      modeId: z.string(),
      actionId: z.string(),
      argument: z.string().optional(),
    })
    .strict(),
]);
export type HarnessCommandState = z.infer<typeof harnessCommandStateSchema>;
export type HarnessOperation = z.infer<typeof harnessOperationSchema>;
export type HarnessCommandContext = {
  sessionId: string;
  agentSessionId?: string;
  cwd?: string;
  workspace?: HarnessWorkspaceContext;
  model?: string | null;
  params?: HarnessParams;
};
/** Discovery also runs before a conversation has a host or native session. */
export type HarnessCommandDiscoveryContext = Omit<HarnessCommandContext, "sessionId"> & { sessionId?: string };
export const draftHarnessCommandInputSchema = z
  .object({
    project_id: z.string().min(1),
    agent: z.string().min(1),
    workspace_id: z.string().optional(),
    model: z.string().optional(),
    params: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
  })
  .strict();
export type DraftHarnessCommandInput = z.infer<typeof draftHarnessCommandInputSchema>;
export const harnessOperationResponseSchema = z.object({
  status: z.enum(["completed", "started"]),
  message: z.string().optional(),
});
export type HarnessOperationResponse = z.infer<typeof harnessOperationResponseSchema>;
export type HarnessOperationResult =
  | { kind: "completed"; message?: string; params?: HarnessParams }
  | { kind: "started"; session: HarnessSession; params?: HarnessParams };
export type PreparedHarnessOperation = {
  /** Controls may run during a turn. Exclusive work acquires the host execution slot. */
  execution: "control" | "exclusive";
  invoke(input: {
    events: HarnessEventSink;
    approvals?: HarnessApprovalChannel;
    questions?: HarnessQuestionChannel;
    signal?: AbortSignal;
  }): Promise<HarnessOperationResult>;
};
