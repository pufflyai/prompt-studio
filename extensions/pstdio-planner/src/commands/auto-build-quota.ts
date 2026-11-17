import { type CommandContext, commandRef } from "@pstdio/sdk/extensions";
import type { readAutoBuildSupervisor } from "../data/auto-build-supervisor";

const quotaAvailability = commandRef.forExtension({ publisher: "pstdio", name: "session-browser" })<
  { harnessId: string },
  { limited: boolean; resetsAt?: string }
>("quota-availability");

export const waitForSupervisorQuota = async (
  ctx: CommandContext,
  supervisor: Awaited<ReturnType<typeof readAutoBuildSupervisor>>,
  session: { agent: string | null } | null,
  model?: { harnessId: string },
) => {
  const harnessId = session?.agent ?? model?.harnessId;
  if (!harnessId) return false;
  const cooldown = supervisor.quotaCooldown;
  if (cooldown?.harnessId === harnessId && Date.parse(cooldown.resetsAt) > Date.now()) return true;
  let quota: { limited: boolean; resetsAt?: string } | undefined;
  try {
    const result = await ctx.commands.execute(quotaAvailability, { params: { harnessId } });
    if (result.ok) quota = result.value;
  } catch {
    ctx.signal?.throwIfAborted();
  }
  delete supervisor.quotaCooldown;
  if (quota?.limited && quota.resetsAt && Date.parse(quota.resetsAt) > Date.now())
    supervisor.quotaCooldown = { harnessId, resetsAt: quota.resetsAt };
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
