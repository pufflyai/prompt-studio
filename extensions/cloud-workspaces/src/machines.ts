import {
  defineWorkspaceType,
  type JsonObject,
  l10n,
  params,
  type WorkspaceProviderRef,
  type WorkspaceProviderResult,
  type WorkspaceProviderState,
} from "@pstdio/sdk/extensions";
import { instancesFor } from "./instances";
import { instanceKind } from "./resources";

export interface Machine {
  id: string;
  state:
    | "queued"
    | "provisioning"
    | "connected"
    | "ready"
    | "preserving"
    | "terminating"
    | "succeeded"
    | "failed"
    | "canceled"
    | "expired"
    | "preserved";
  agent_state: string;
  change_cursor: number;
  reason_code: string | null;
  failure: { log_tail: string } | null;
}

export interface ControllerMachine extends Machine {
  origin_workspace_id?: string | null;
  restored_from_checkpoint_id?: string | null;
  connected_at?: string | null;
  external_id: string;
  created_at: string;
  template: { name: string; version: string; digest: string };
  metadata: Record<string, string>;
  persistence: {
    enabled: boolean;
    conversation_resume: { status: "supported" | "unsupported" | "unknown"; reason: string | null };
    latest_checkpoint_id: string | null;
  };
}

export const machinePath = (id: string) => `/v1/workspaces/${encodeURIComponent(id)}`;
export const isTerminal = (machine: Pick<Machine, "state">) =>
  ["succeeded", "failed", "canceled", "expired", "preserved"].includes(machine.state);
export const machineRef = (ref: WorkspaceProviderRef) => {
  if (ref.version !== 1 || typeof ref.data.instanceId !== "string" || typeof ref.data.machineId !== "string") {
    throw new Error("Invalid PocketCoder machine reference.");
  }
  return { instanceId: ref.data.instanceId, machineId: ref.data.machineId };
};

export function projectMachine(extensionId: string, instanceId: string, machine: Machine) {
  const states: Record<Machine["state"], WorkspaceProviderState> = {
    queued: "provisioning",
    provisioning: "provisioning",
    connected: "provisioning",
    ready: "ready",
    preserving: "provisioning",
    terminating: "deleting",
    succeeded: "archived",
    failed: "failed",
    canceled: "cancelled",
    expired: "failed",
    preserved: "archived",
  };
  const providerRef = { version: 1, data: { instanceId, machineId: machine.id } };
  const state = states[machine.state];
  return {
    providerRef,
    state,
    executionKind: "remote",
    executionTarget: { kind: "remote", providerId: `${extensionId}.workspace-type.machine`, providerRef },
    displayPath: `PocketCoder / ${machine.id}`,
    capabilities: { files: "none", diff: false, merge: false, rebase: false, delete: true },
    ...(state === "failed"
      ? {
          error: {
            code: machine.reason_code ?? machine.state,
            message:
              machine.failure?.log_tail || `Machine ${machine.state}: ${machine.reason_code ?? "no reason supplied"}.`,
            retryable: false,
          },
        }
      : {}),
  } satisfies WorkspaceProviderResult;
}

export const providerParams = {
  instance: params.text({
    label: l10n("cloud-workspaces.pocketcoder-instance-id", "PocketCoder instance ID"),
    required: true,
  }),
  template: params.text({ label: l10n("cloud-workspaces.agent-template", "Agent template"), required: true }),
  templateVersion: params.text({
    label: l10n("cloud-workspaces.template-version-optional", "Template version (optional)"),
  }),
  externalId: params.text({
    label: l10n("cloud-workspaces.application-task-id-optional", "Application task ID (optional)"),
  }),
  launchInput: params.longText({
    label: l10n("cloud-workspaces.one-time-launch-input-json-optional", "One-time launch input (JSON, optional)"),
  }),
  metadata: params.longText({
    label: l10n("cloud-workspaces.application-metadata-json-optional", "Application metadata (JSON, optional)"),
  }),
};

export function launchInputOf(source: unknown) {
  if (source === undefined || source === "") return undefined;
  if (typeof source !== "string") throw new Error("Launch input must be a JSON object.");
  const value: unknown = JSON.parse(source);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Launch input must be a JSON object.");
  return value as JsonObject;
}

export function createMachineProvider(getInstances = instancesFor) {
  return defineWorkspaceType({
    id: "machine",
    label: l10n("cloud-workspaces.pocketcoder-agent-machine", "PocketCoder agent machine"),
    icon: "server",
    params: providerParams,
    async create(ctx, input) {
      const { instance, template, templateVersion } = input.params;
      const launchInput = launchInputOf(input.params.launchInput);
      const metadata = launchInputOf(input.params.metadata);
      if (typeof instance !== "string" || typeof template !== "string" || !template.trim())
        throw new Error("Choose an instance and agent template.");
      await ctx.workspaces.addAnchors(input.workspaceId, [
        { type: instanceKind.id, extensionId: ctx.extensionId, id: instance, role: "context" },
      ]);
      const machine = await getInstances(ctx.projectId).request<Machine>(instance, "/v1/workspaces", {
        method: "POST",
        headers: { "Idempotency-Key": input.operationId },
        body: JSON.stringify({
          external_id: input.params.externalId || input.workspaceId,
          template: { name: template, ...(templateVersion ? { version: templateVersion } : {}) },
          ...(launchInput ? { launch_input: launchInput } : {}),
          ...(metadata ? { metadata } : {}),
        }),
        signal: input.signal,
      });
      return projectMachine(ctx.extensionId, instance, machine);
    },
    async resolve(ctx, input) {
      const { instanceId, machineId } = machineRef(input.providerRef);
      return projectMachine(
        ctx.extensionId,
        instanceId,
        await getInstances(ctx.projectId).request<Machine>(instanceId, machinePath(machineId)),
      );
    },
    async cancel(ctx, input) {
      const { instanceId, machineId } = machineRef(input.providerRef);
      const machine = await getInstances(ctx.projectId).request<Machine>(
        instanceId,
        `${machinePath(machineId)}/cancel`,
        { method: "POST" },
      );
      return projectMachine(ctx.extensionId, instanceId, machine);
    },
    async delete(ctx, input) {
      const { instanceId, machineId } = machineRef(input.providerRef);
      const instances = getInstances(ctx.projectId);
      let machine = await instances.request<Machine>(instanceId, machinePath(machineId));
      if (!isTerminal(machine))
        machine = await instances.request<Machine>(instanceId, `${machinePath(machineId)}/cancel`, { method: "POST" });
      while (!isTerminal(machine)) {
        const change = await instances.request<{ workspace: Machine }>(
          instanceId,
          `${machinePath(machineId)}/changes?after=${machine.change_cursor}&wait=30`,
        );
        machine = change.workspace;
      }
    },
  });
}
