import type { ExtensionCommandRecord } from "@pstdio/sdk/api";
import { CommandOutcomeError, type ResourceRef } from "@pstdio/sdk/extensions";
import { viewFilterGroupSchema } from "pstdio-api-contracts";
import { defaultPageResourceCodec } from "pstdio-api-contracts/extension-kernel";
import { text } from "pstdio-extensions/workbench";
import { z } from "zod";
import { classifyApiWrite } from "../../core/registries/mutations/operation-failures";
import type { OperationCheck } from "../../core/registries/mutations/operation-types";
import { operationSubject, type WorkbenchOperations } from "../../core/registries/mutations/operations";

export const extensionCommandOperation = "extension.command";
const artifactPublication = "pstdio.artifacts.command.publish";
const plannerAttempt = "pstdio.planner.command.run-attempt";
const plannerReview = "pstdio.planner.command.review";
const plannerAutoBuildConfigure = "pstdio.planner.command.auto-build.configure";
export const plannerGateLaunch = "pstdio.planner.command.timeline.gate.launch";
export const plannerGateLaunchCheck = "pstdio.planner.command.timeline.gate.check-launch";
const reviewDraftSchema = z.object({
  requestId: z.string(),
  response: z.union([
    z.object({ confirmed: z.literal(true) }),
    z.object({ answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])) }),
  ]),
});
const autoBuildDraftSchema = z.object({
  enabled: z.boolean(),
  prompt: z.string().optional(),
  supervisorModel: z.object({ harnessId: z.string(), model: z.string().optional() }).optional(),
  eligible: viewFilterGroupSchema.optional(),
  requireMergedDependencies: z.boolean().optional(),
  blockOnReview: z.boolean().optional(),
});
const plannerDraftSchemas = new Map<string, z.ZodType<Record<string, unknown>>>([
  [plannerReview, reviewDraftSchema],
  [plannerAutoBuildConfigure, autoBuildDraftSchema],
]);
const isPlannerAttempt = (command: ExtensionCommandRecord) =>
  command.id === plannerAttempt && command.extensionId === "pstdio.planner";
const isPlannerGateLaunch = (command: ExtensionCommandRecord) =>
  command.id === plannerGateLaunch && command.extensionId === "pstdio.planner";

const retainAttemptInput = (draft: Record<string, unknown>, params?: Record<string, unknown>) => {
  for (const key of ["ticket", "rowId"]) {
    if (typeof params?.[key] === "string") draft[key] = params[key];
  }
  if (typeof params?.newVariant === "boolean") draft.newVariant = params.newVariant;
  const agent = params?.agent as { harnessId?: unknown; model?: unknown } | undefined;
  if (typeof agent?.harnessId === "string")
    draft.agent = { harnessId: agent.harnessId, ...(typeof agent.model === "string" ? { model: agent.model } : {}) };
  const workspace = params?.workspace as { providerId?: unknown; params?: { base?: unknown } } | undefined;
  if (workspace?.providerId === "pstdio.worktree" && typeof workspace.params?.base === "string")
    draft.workspace = { providerId: workspace.providerId, params: { base: workspace.params.base } };
  return draft;
};

const retainGateInput = (draft: Record<string, unknown>, params?: Record<string, unknown>) => {
  for (const key of ["ticket", "after", "attemptId"]) if (typeof params?.[key] === "string") draft[key] = params[key];
  return draft;
};

const retainedCommandDraft = (command: ExtensionCommandRecord, projectId: string, params?: Record<string, unknown>) => {
  const draft: Record<string, unknown> = { commandId: command.id };
  if (isPlannerAttempt(command)) return retainAttemptInput(draft, params);
  if (isPlannerGateLaunch(command)) return retainGateInput(draft, params);
  if (command.extensionId === "pstdio.planner") {
    const result = plannerDraftSchemas.get(command.id)?.safeParse(params);
    if (result?.success) return { ...draft, ...result.data };
  }
  if (command.id !== artifactPublication || command.extensionId !== "pstdio.artifacts") return draft;
  for (const key of ["file_path", "favicon", "label"]) {
    const value = params?.[key];
    if (typeof value === "string") draft[key] = value;
  }
  const url = params?.url;
  const path = `/projects/${encodeURIComponent(projectId)}/extensions/pstdio.artifacts/artifacts/view`;
  if (typeof url === "string" && url.startsWith(`${path}?`)) {
    const location = new URL(url, "http://localhost");
    const uri = location.searchParams.get("resource");
    const resource = uri && defaultPageResourceCodec.fromUri(uri);
    if (
      resource &&
      resource.type === "artifact" &&
      resource.extensionId === command.extensionId &&
      resource.projectId === projectId &&
      location.pathname === path
    ) {
      const search = new URLSearchParams({ resource: defaultPageResourceCodec.toUri(resource) });
      draft.url = `${path}?${search}`;
    }
  }
  return draft;
};

export const runWorkbenchCommandOperation = <T>(input: {
  operations: WorkbenchOperations;
  projectId: string;
  command: ExtensionCommandRecord;
  source?: ResourceRef;
  params?: Record<string, unknown>;
  onAdmitted?(): void;
  check?(signal: AbortSignal): Promise<OperationCheck<T>>;
  write(signal: AbortSignal): Promise<T>;
}) => {
  const { operations, projectId, command, source } = input;
  const gateTicket =
    isPlannerGateLaunch(command) && typeof input.params?.ticket === "string" ? input.params.ticket : undefined;
  // The declaration does not promise a record identity. Match every invocation of the command in this project.
  const requestId =
    command.extensionId === "pstdio.planner" &&
    command.id === plannerReview &&
    typeof input.params?.requestId === "string"
      ? input.params.requestId
      : undefined;
  const identity = requestId ?? gateTicket;
  const subjects = identity ? [command.id, identity] : [command.id];
  const subject = operationSubject(extensionCommandOperation, projectId, ...subjects);
  const { pending, recovery } = operations.getSnapshot();
  const matches = (entry: { subjects: readonly string[] }) => entry.subjects.includes(subject);
  if (pending.some(matches) || recovery.some((entry) => entry.status !== "rejected" && matches(entry)))
    throw new Error("This action is still pending. See System activity for recovery.");
  const result = operations.submit({
    domain: extensionCommandOperation,
    projectId,
    subjects: [subject],
    title: text(command.title, "Run extension action"),
    source,
    draft: retainedCommandDraft(command, projectId, input.params),
    describeRecovery: () => "The action could not be confirmed. Inspect its result before discarding the attempt.",
    releaseOnDiscard: true,
    showPending: true,
    classify: (error) => {
      const refusal = isPlannerAttempt(command) ? "AttemptLaunchRefused" : "GateLaunchRefused";
      if (
        (isPlannerAttempt(command) || isPlannerGateLaunch(command)) &&
        error instanceof CommandOutcomeError &&
        error.outcome.status === "error" &&
        error.outcome.error?.name === refusal
      )
        return "rejected";
      return classifyApiWrite(error);
    },
    check: input.check,
    write: input.write,
  }).result;
  if (
    isPlannerAttempt(command) ||
    (command.id === artifactPublication &&
      command.extensionId === "pstdio.artifacts" &&
      typeof input.params?.file_path === "string" &&
      input.params.file_path.trim())
  )
    input.onAdmitted?.();
  return result;
};
