type SlottedContribution = {
  id: string;
  slotId: string;
  placement?: "first" | "default" | "last";
};

const placementOrder = { first: 0, default: 1, last: 2 } satisfies Record<
  NonNullable<SlottedContribution["placement"]>,
  number
>;

export const filterContributionsForSlot = <TContribution extends SlottedContribution>(
  contributions: TContribution[],
  slotId: string,
) => contributions.filter((contribution) => contribution.slotId === slotId);

export const orderContributions = <TContribution extends SlottedContribution>(contributions: TContribution[]) =>
  [...contributions].sort((a, b) => {
    const placementDelta = placementOrder[a.placement ?? "default"] - placementOrder[b.placement ?? "default"];
    return placementDelta || a.id.localeCompare(b.id);
  });

export const getSlotContributions = <TContribution extends SlottedContribution>(
  contributions: TContribution[],
  slotId: string,
) => orderContributions(filterContributionsForSlot(contributions, slotId));

export const getSlotContributionsForSlots = <TContribution extends SlottedContribution>(
  contributions: TContribution[],
  slotIds: string[],
) => slotIds.flatMap((slotId) => getSlotContributions(contributions, slotId));
