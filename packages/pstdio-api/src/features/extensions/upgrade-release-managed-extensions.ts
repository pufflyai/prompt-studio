import { apiLogger } from "../../lib/logger";
import type { RouteDeps } from "../deps";
import { refreshProjectSkillsInRepos } from "./extension-skill-cleanup";

/**
 * Brings extensions the host installed from a release up to the release paired with this host.
 * The host release only changes when the host restarts, so startup is the one place this runs.
 * Which sources qualify is decided by the upgrade service; everything else keeps its Upgrade offer.
 */
export const upgradeReleaseManagedExtensions = async (deps: RouteDeps, signal?: AbortSignal) => {
  const projects = await deps.projectService.list();
  let upgraded = false;
  const visited = new Set<string>();

  for (const project of projects) {
    for (const { instance, installedSource } of await deps.extensionService.listProjectExtensionInstances(project.id)) {
      if (signal?.aborted) return;
      if (visited.has(installedSource.id)) continue;
      visited.add(installedSource.id);
      try {
        if (!(await deps.extensionUpgradeService.canUpgradeAutomatically(installedSource))) continue;
        const result = await deps.extensionUpgradeService.upgrade(project.id, instance.id);
        upgraded ||= result?.changed === true;
      } catch (err) {
        apiLogger.warn(
          { err, event: "startup.extension_upgrade.warning", extension: installedSource.install_name },
          "Automatic extension upgrade failed; the installed version keeps running",
        );
      }
    }
  }

  // An upgraded user-global source changes the skills of every project that enables it.
  if (!upgraded) return;
  for (const project of projects) await refreshProjectSkillsInRepos(deps, project.id);
};
