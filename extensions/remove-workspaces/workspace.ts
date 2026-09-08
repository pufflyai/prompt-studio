import {
  defineWorkspaceType,
  l10n,
  params,
  type WorkspaceProviderRef,
  type WorkspaceProviderResult,
  type WorkspaceProviderState,
} from "@pstdio/sdk/extensions";
import {
  cancelWorkspace,
  getWorkspace,
  isTerminal,
  type PocketCoderWorkspace,
  request,
  workspacePath,
} from "./pocketcoder";

export const workspaceParams = {
  template: params.text({ label: l10n("params.template", "PocketCoder template"), required: true }),
  templateVersion: params.text({ label: l10n("params.template-version", "Template version (optional)") }),
  repository: params.text({ label: l10n("params.repository", "Repository alias (optional)") }),
  revision: params.text({ label: l10n("params.revision", "Branch, tag, or commit (with repository alias)") }),
};

export const remoteId = (ref: WorkspaceProviderRef) => {
  if (ref.version !== 1 || typeof ref.data.remoteId !== "string" || !ref.data.remoteId) {
    throw new Error("The workspace has no valid PocketCoder reference.");
  }
  return ref.data.remoteId;
};

const states: Record<PocketCoderWorkspace["state"], WorkspaceProviderState> = {
  queued: "provisioning",
  provisioning: "provisioning",
  connected: "provisioning",
  ready: "ready",
  preserving: "archiving",
  terminating: "deleting",
  succeeded: "archived",
  failed: "failed",
  canceled: "cancelled",
  expired: "failed",
  preserved: "archived",
};

const projectWorkspace = (extensionId: string, workspace: PocketCoderWorkspace) => {
  const providerRef = { version: 1, data: { remoteId: workspace.id } };
  const state = states[workspace.state];
  if (!state) throw new Error(`Unknown PocketCoder workspace state: ${workspace.state}`);
  return {
    providerRef,
    state,
    executionKind: "remote",
    executionTarget: { kind: "remote", providerId: `${extensionId}.workspace-type.remote`, providerRef },
    displayPath: `PocketCoder / ${workspace.id}`,
    capabilities: { files: "none", diff: false, merge: false, rebase: false, archive: false, delete: true },
    ...(state === "failed"
      ? {
          error: {
            code: workspace.reason_code ?? workspace.state,
            message:
              workspace.failure?.log_tail ||
              `PocketCoder workspace ${workspace.state}: ${workspace.reason_code ?? "no reason supplied"}.`,
            retryable: false,
          },
        }
      : {}),
  } satisfies WorkspaceProviderResult;
};

export const remoteWorkspace = defineWorkspaceType({
  id: "remote",
  label: l10n("workspace-types.remote", "PocketCoder workspace"),
  params: workspaceParams,
  async create(ctx, input) {
    const { template, templateVersion, repository, revision } = input.params;
    if (typeof template !== "string" || !template.trim()) throw new Error("Choose a PocketCoder template.");
    if (Boolean(repository) !== Boolean(revision)) throw new Error("Provide both a repository alias and a revision.");
    const workspace = await request<PocketCoderWorkspace>(ctx, {
      method: "POST",
      path: "/v1/workspaces",
      headers: { "Idempotency-Key": input.operationId },
      body: {
        external_id: input.workspaceId,
        template: { name: template, ...(templateVersion ? { version: templateVersion } : {}) },
        ...(repository ? { source: { kind: "git", repository, revision } } : {}),
      },
      signal: input.signal,
    });
    return projectWorkspace(ctx.extensionId, workspace);
  },
  async resolve(ctx, input) {
    return projectWorkspace(ctx.extensionId, await getWorkspace(ctx, remoteId(input.providerRef)));
  },
  async cancel(ctx, input) {
    return projectWorkspace(ctx.extensionId, await cancelWorkspace(ctx, remoteId(input.providerRef)));
  },
  async delete(ctx, input) {
    let workspace = await cancelWorkspace(ctx, remoteId(input.providerRef));
    while (!isTerminal(workspace)) {
      const change = await request<{ workspace: PocketCoderWorkspace }>(ctx, {
        method: "GET",
        path: `${workspacePath(workspace.id)}/changes?after=${workspace.change_cursor}&wait=30`,
        timeoutMs: 35_000,
      });
      workspace = change.workspace;
    }
  },
});
