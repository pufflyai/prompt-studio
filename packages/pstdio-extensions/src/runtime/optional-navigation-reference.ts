import type { NavigationTreeContribution } from "@pstdio/sdk/extensions";

const absentForeignExtension = (
  extensionId: string | undefined,
  owner: string,
  extensions: readonly { id: string }[],
) => Boolean(extensionId) && extensionId !== owner && !extensions.some((extension) => extension.id === extensionId);

export const hasAbsentOptionalNavigationOwner = (
  record: { extensionId: string; contribution: Pick<NavigationTreeContribution, "owner" | "optionalOwner"> },
  extensions: readonly { id: string }[],
) => {
  return (
    record.contribution.optionalOwner === true &&
    absentForeignExtension(record.contribution.owner.extensionId, record.extensionId, extensions)
  );
};

export const hasAbsentOptionalNavigationView = (
  record: { extensionId: string; contribution: Pick<NavigationTreeContribution, "view" | "optionalView"> },
  extensions: readonly { id: string }[],
) =>
  record.contribution.optionalView === true &&
  absentForeignExtension(record.contribution.view.extensionId, record.extensionId, extensions);
