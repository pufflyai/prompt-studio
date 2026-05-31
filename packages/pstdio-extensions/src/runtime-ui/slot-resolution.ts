import type { MenuContribution, SlotRef, Struct } from "@pstdio/sdk/extensions";
import type { ExtensionRuntime, RuntimeCommandRecord } from "../types/runtime";

export type SlottedContribution = {
  id: string;
  slotId: string;
  placement?: "first" | "default" | "last";
};

const placementOrder = { first: 0, default: 1, last: 2 } satisfies Record<
  NonNullable<SlottedContribution["placement"]>,
  number
>;

const slotIdOf = (slot: MenuContribution["slot"]) => (typeof slot === "string" ? slot : slot?.id);

const slotRefId = <TContext extends Struct>(slot: SlotRef<TContext> | string) =>
  typeof slot === "string" ? slot : slot.id;

export type ResolvedMenuItem = {
  slotId: string;
  command: RuntimeCommandRecord;
  contribution: MenuContribution;
};

export const filterContributionsForSlot = <TContribution extends SlottedContribution>(
  contributions: readonly TContribution[],
  slotId: string,
) => contributions.filter((contribution) => contribution.slotId === slotId);

export const orderContributions = <TContribution extends SlottedContribution>(
  contributions: readonly TContribution[],
) =>
  [...contributions].sort((left, right) => {
    const placementDelta = placementOrder[left.placement ?? "default"] - placementOrder[right.placement ?? "default"];
    return placementDelta || left.id.localeCompare(right.id);
  });

export const getSlotContributions = <TContribution extends SlottedContribution>(
  contributions: readonly TContribution[],
  slotId: string,
) => orderContributions(filterContributionsForSlot(contributions, slotId));

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
      if (!contribution.slot || slotIdOf(contribution.slot) !== targetId) continue;
      result.push({ slotId: targetId, command, contribution });
    }
  }

  return result;
};
