import { provisionProjectWorkspaces } from "../workspaces/provision-coordinator";
import type { ExtensionsRouteDeps } from "./deps";

type SkillRefreshDeps = ExtensionsRouteDeps;

// Catalog-change entry point: re-provision so harness extensions sync their agent
// dirs to the current skill catalog and prune anything that left it.
export const refreshProjectSkillsInRepos = async (deps: SkillRefreshDeps, projectId: string) => {
  await provisionProjectWorkspaces(deps, projectId);
};
