import { addContributionAlias, registerRegistryAliases } from "../../core/shared/contributions/identity-aliases";
import type { RegisterWorkbenchExtensionContributionsInput } from "./workbench-extension-host-types";

export const registerWorkbenchIdentityAliases = (input: RegisterWorkbenchExtensionContributionsInput) => {
  const aliases = new Map<string, string>();
  const groups = { views: "view", pages: "page", modes: "mode", placements: "placement" } as const;
  for (const [group, kind] of Object.entries(groups))
    for (const record of input.metadata[group as keyof typeof groups]) addContributionAlias(aliases, record, kind);
  for (const record of input.metadata.commands)
    if (record.localId) addContributionAlias(aliases, { ...record, localId: record.localId }, "command");
  const { workbench } = input;
  return [workbench.views.store, workbench.pages.store, workbench.modes.store, workbench.commands.store].map((store) =>
    registerRegistryAliases(store, aliases),
  );
};
