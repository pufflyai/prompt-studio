import type { MenuContribution, SlotRef, Struct } from "@pstdio/sdk/extensions";
import type { ExtensionRuntime, RuntimeCommandRecord } from "../types/runtime";

const slotIdOf = (slot: MenuContribution["slot"]) => (typeof slot === "string" ? slot : slot.id);

const slotRefId = <TContext extends Struct>(slot: SlotRef<TContext> | string) =>
  typeof slot === "string" ? slot : slot.id;

export type ResolvedMenuItem = {
  slotId: string;
  command: RuntimeCommandRecord;
  contribution: MenuContribution;
};

/**
 * Resolve menu contributions attached to a slot, paired with the command that owns each menu.
 * Pure read of the runtime registry — safe to call in browser code.
 */
export const resolveMenuContributionsForSlot = <TContext extends Struct>(
  runtime: Pick<ExtensionRuntime, "commands">,
  slot: SlotRef<TContext, "menu"> | string,
): ResolvedMenuItem[] => {
  const targetId = slotRefId(slot);
  const result: ResolvedMenuItem[] = [];

  for (const command of runtime.commands) {
    for (const contribution of command.menus ?? []) {
      if (slotIdOf(contribution.slot) !== targetId) continue;
      result.push({ slotId: targetId, command, contribution });
    }
  }

  return result;
};
