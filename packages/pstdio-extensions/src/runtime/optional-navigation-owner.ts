import type { NavigationTreeContribution } from "@pstdio/sdk/extensions";

export const hasAbsentOptionalNavigationOwner = (
  record: { extensionId: string; contribution: Pick<NavigationTreeContribution, "owner" | "optionalOwner"> },
  extensions: readonly { id: string }[],
) => {
  const owner = record.contribution.owner.extensionId;
  return (
    record.contribution.optionalOwner === true &&
    Boolean(owner) &&
    owner !== record.extensionId &&
    !extensions.some((extension) => extension.id === owner)
  );
};
