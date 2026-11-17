import { matchesPlatform, type quarantineRegistry } from "./test-quarantine";
import type { readWorkspacePackages } from "./workspace-packages";
export const quarantineGroups = (
  registry: typeof quarantineRegistry,
  packages: ReturnType<typeof readWorkspacePackages>,
  runner: string,
  platform: string,
  arch: string,
  scope?: string,
) => {
  const selected = registry.filter((entry) => entry.runner === runner && matchesPlatform(entry, platform, arch));
  if (selected.some((entry) => !packages.some((owner) => entry.file.startsWith(`${owner.dir}/`))))
    throw new Error("Quarantine case has no owning workspace");
  const owners = packages.filter(
    (owner) => !scope || scope.split(",").some((name) => name === owner.name || name === owner.dir),
  );
  if (scope && !owners.length) throw new Error("Unknown quarantine scope");
  return owners
    .map((owner) => ({ owner, entries: selected.filter((entry) => entry.file.startsWith(`${owner.dir}/`)) }))
    .filter((group) => group.entries.length);
};
