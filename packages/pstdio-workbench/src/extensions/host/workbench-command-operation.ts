import type { ExtensionCommandRecord } from "@pstdio/sdk/api";
import type { ResourceRef } from "@pstdio/sdk/extensions";
import { defaultPageResourceCodec } from "pstdio-api-contracts/extension-kernel";
import { text } from "pstdio-extensions/workbench";
import { classifyApiWrite } from "../../core/registries/mutations/operation-failures";
import { operationSubject, type WorkbenchOperations } from "../../core/registries/mutations/operations";

export const extensionCommandOperation = "extension.command";
const artifactPublication = "pstdio.artifacts.command.publish";

const retainedCommandDraft = (command: ExtensionCommandRecord, projectId: string, params?: Record<string, unknown>) => {
  const draft: Record<string, string> = { commandId: command.id };
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
  write(signal: AbortSignal): Promise<T>;
}) => {
  const { operations, projectId, command, source } = input;
  // The declaration does not promise a record identity. Match every invocation of the command in this project.
  const subject = operationSubject(extensionCommandOperation, projectId, command.id);
  if (operations.getSnapshot().pending.some((entry) => entry.subjects.includes(subject)))
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
    classify: classifyApiWrite,
    write: input.write,
  }).result;
  if (
    command.id === artifactPublication &&
    command.extensionId === "pstdio.artifacts" &&
    typeof input.params?.file_path === "string" &&
    input.params.file_path.trim()
  )
    input.onAdmitted?.();
  return result;
};
