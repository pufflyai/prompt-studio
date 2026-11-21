import type { ConversationSummary } from "@pstdio/pocketcoder-sdk";
import { type CommandContext, sessionBrowser } from "@pstdio/sdk/extensions";
import type { instancesFor } from "./instances";
import type { ControllerMachine } from "./machines";
import { machinePath } from "./machines";

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
