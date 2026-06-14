import type { HarnessRegistryService, HarnessScopeOptions } from "./harness-registry-service";

/** A harness that declared where its agent discovers skills. */
export type SkillAgent = {
  id: string;
  extensionId: string;
  skillsDir: string;
  globalSkillsDir: string;
};

// Skill setup follows the harness lifecycle: every harness that declares a skills
// layout is a target; project scoping limits this to harnesses enabled for the project.
export const listSkillAgents = async (
  harnessRegistry: HarnessRegistryService,
  options?: HarnessScopeOptions,
): Promise<SkillAgent[]> =>
  (await harnessRegistry.list(options))
    .filter((harness) => harness.skills)
    .map((harness) => ({
      id: harness.id,
      extensionId: harness.extensionId,
      skillsDir: harness.skills!.dir,
      globalSkillsDir: harness.skills!.globalDir,
    }));
