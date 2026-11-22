import type { ConversationSummary } from "@pstdio/pocketcoder-sdk";
import { type CommandContext, sessionBrowser } from "@pstdio/sdk/extensions";
import type { instancesFor } from "./instances";
import type { machineConnection } from "./machine-connection";
import type { ControllerMachine } from "./machines";
import { machinePath } from "./machines";

const attachOperation = (instanceId: string, machineId: string, conversationId: string) => ({
  kind: "command" as const,
  text: `/attach ${instanceId}:${machineId}:${conversationId}`,
});

export async function machineConversationToAttach(
  instances: ReturnType<typeof instancesFor>,
  instanceId: string,
  machine: ControllerMachine,
  existing: { id: string; agentSessionId: string | null; status: string } | null,
) {
  if (existing?.agentSessionId || (existing && ["in_progress", "awaiting_input", "queued"].includes(existing.status)))
    return;
  if (existing) {
    const saved = await instances.sessionTarget(existing.id).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return undefined;
    });
    if (saved?.instanceId === instanceId && saved.machineId === machine.id && saved.conversationId)
      return saved.conversationId;
  }
  return latestMachineConversation(instances, instanceId, machine);
}

export async function attachMachineSession(
  ctx: CommandContext,
  sessionId: string,
  instanceId: string,
  machineId: string,
  conversationId: string,
) {
  const result = await ctx.sessions.invokeHarnessOperation(
    sessionId,
    attachOperation(instanceId, machineId, conversationId),
    `${ctx.extensionId}.harness.agent`,
  );
  if (result.status !== "started") throw new Error(result.message || "Could not load the machine conversation.");
}

export async function createMachineSession(
  ctx: CommandContext,
  instanceId: string,
  machine: ControllerMachine,
  connection: Awaited<ReturnType<typeof machineConnection>>,
  conversationId?: string,
) {
  const session = await ctx.sessions.create({
    title: `PocketCoder: ${machine.external_id}`,
    ...(connection.kind === "relay"
      ? {
          deviceId: connection.deviceId,
          workspaceId: connection.workspaceId,
          harness: { harnessId: "pstdio.harness-codex.harness.codex" },
        }
      : {
          harness: { harnessId: `${ctx.extensionId}.harness.agent` },
          operation: conversationId ? attachOperation(instanceId, machine.id, conversationId) : undefined,
        }),
  });
  if (conversationId && session.operationResult?.status !== "started")
    throw new Error(session.operationResult?.message || "Could not load the machine conversation.");
  return session;
}

export const machineSessionTarget = (projectId: string, session: { id: string; title: string }) => ({
  kind: "panel" as const,
  panel: sessionBrowser.panels.conversation,
  open: "pin" as const,
  resource: { type: "session", extensionId: "pstdio", projectId, id: session.id, label: session.title },
});

export async function previousMachineSession(ctx: CommandContext, instanceId: string, machineId: string) {
  const candidates = (await ctx.workspaces.list()).filter(
    (workspace) =>
      workspace.providerId === `${ctx.extensionId}.workspace-type.machine` &&
      workspace.anchors_json?.some((anchor) => anchor.id === instanceId),
  );
  for (const old of candidates) {
    const resolved = await ctx.workspaces.resolve(old.id);
    if (resolved.providerRef?.data.machineId === machineId) return ctx.storage.get<string>(`machine-session:${old.id}`);
  }
}

export async function checkRelayDevice(ctx: CommandContext, deviceId: string) {
  const device = (await ctx.account.devices()).find((device) => device.id === deviceId);
  if (!device || device.current) throw new Error("Choose the machine's remote Prompt Studio device, not this host.");
  if (!device.online)
    throw new Error("The machine's Prompt Studio device is offline. Start its relay connection and try again.");
}

export async function latestMachineConversation(
  instances: ReturnType<typeof instancesFor>,
  instanceId: string,
  machine: ControllerMachine,
) {
  const page = await instances.request<{ items: ConversationSummary[] }>(
    instanceId,
    `${machinePath(machine.id)}/conversations`,
  );
  return (
    page.items
      .filter((item) => item.status === "retained" && item.conversation_id)
      .sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at))
      .at(0)?.conversation_id ?? undefined
  );
}
