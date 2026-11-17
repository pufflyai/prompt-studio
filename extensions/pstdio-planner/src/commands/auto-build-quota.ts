import { type CommandContext, commandRef, type ExtensionHarnessInput } from "@pstdio/sdk/extensions";
import type { readAutoBuildSupervisor } from "../data/auto-build-supervisor";

const quotaAvailability = commandRef.forExtension({ publisher: "pstdio", name: "session-browser" })<
  { harnessId: string; modelId?: string },
  { known: boolean; limited: boolean; resetsAt?: string }
>("quota-availability");

export const waitForSupervisorQuota = async (
  ctx: CommandContext,
  supervisor: Awaited<ReturnType<typeof readAutoBuildSupervisor>>,
  session: { agent: string | null; lastSelectedModel: string | null } | null,
  selection?: ExtensionHarnessInput,
) => {
  const harnessId = session?.agent ?? selection?.harnessId;
  if (!harnessId) return false;
  const modelId = session?.lastSelectedModel ?? (selection?.harnessId === harnessId ? selection.model : undefined);
  const params = { harnessId, ...(modelId ? { modelId } : {}) };
  const cooldown = supervisor.quotaCooldown;
  const activeCooldown = cooldown?.harnessId === harnessId && Date.parse(cooldown.resetsAt) > Date.now();
  if (activeCooldown && cooldown.modelId === modelId) return true;
  let quota: { known: boolean; limited: boolean; resetsAt?: string } | undefined;
  try {
    const result = await ctx.commands.execute(quotaAvailability, { params });
    if (result.ok) quota = result.value;
  } catch {
    ctx.signal?.throwIfAborted();
  }
  const reset =
    quota?.limited && quota.resetsAt && Date.parse(quota.resetsAt) > Date.now() ? quota.resetsAt : undefined;
  // An older cooldown has no model identity. Keep it until a fresh reading can replace it.
  if (activeCooldown && cooldown.modelId === undefined && !reset && (!quota?.known || quota.limited)) return true;
  delete supervisor.quotaCooldown;
  if (reset) supervisor.quotaCooldown = { ...params, resetsAt: reset };
  if (cooldown || supervisor.quotaCooldown)
    await ctx.storage.records.commit({
      operationId: ctx.storage.ids.create(),
      edits: [
        {
          recordId: ctx.storage.records.id("auto-build-supervisor"),
          replace: JSON.parse(JSON.stringify(supervisor)),
        },
      ],
    });
  return quota?.limited === true;
};
