import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getBundledSkills } from "pstdio-agents";
import { findAgent } from "pstdio-api-contracts/known-agents";
import type { SkillsRouteDeps } from "./deps";
import { installSkillToRepo } from "./install-skill-to-repo";

type Deps = Pick<
  SkillsRouteDeps,
  "projectService" | "repoService" | "skillService" | "agentConfigService" | "fileService"
>;

const isSkillInstalled = (repoPath: string, agentId: string, skillName: string) => {
  const agent = findAgent(agentId);
  if (!agent) return true;
  return existsSync(join(repoPath, agent.skillsDir, skillName, "SKILL.md"));
};

const installMissingSkillsForProject = async (deps: Deps, projectId: string, agents: { agent_id: string }[]) => {
  const [repos, skills] = await Promise.all([
    deps.repoService.listByProject(projectId),
    deps.skillService.list(projectId),
  ]);

  for (const skill of skills) {
    if (skill.files.length === 0) continue;

    for (const repo of repos) {
      for (const agent of agents) {
        if (isSkillInstalled(repo.path, agent.agent_id, skill.name)) continue;

        installSkillToRepo(repo.path, agent.agent_id, skill.name, skill.files);
      }
    }
  }
};

const hydrateLegacySkillFilesForProject = async (deps: Deps, projectId: string) => {
  const skills = await deps.skillService.list(projectId);

  for (const skill of skills) {
    if (skill.files.length > 0) continue;
    if (!("legacy_file_id" in skill) || !skill.legacy_file_id) continue;

    const file = await deps.fileService.get(skill.legacy_file_id);
    if (!file) continue;

    const content = await readFile(file.storage_path, "utf8");
    await deps.skillService.update(projectId, skill.name, {
      files: [{ path: "SKILL.md", content, encoding: "utf8" }],
    });
  }
};

const parseSkillVersion = (content: string) => {
  const match = content.match(/- version:\s*(.+)/);
  return match?.[1]?.trim() ?? "";
};

const syncSingleFileSkillsWithBundledForProject = async (
  deps: Deps,
  projectId: string,
  agents: { agent_id: string }[],
) => {
  const [skills, bundled, repos] = await Promise.all([
    deps.skillService.list(projectId),
    getBundledSkills(),
    deps.repoService.listByProject(projectId),
  ]);

  for (const skill of skills) {
    if (skill.files.length === 0) continue;

    const bundledSkill = bundled.find((s) => s.name === skill.name);
    if (!bundledSkill || bundledSkill.files.length <= 1) continue;

    const storedSkillFile = skill.files.find((f) => f.path === "SKILL.md");
    if (!storedSkillFile) continue;

    const storedVersion = parseSkillVersion(storedSkillFile.content);
    if (!storedVersion || storedVersion !== bundledSkill.version) continue;

    const storedPaths = new Set(skill.files.map((f) => f.path));
    const bundledPaths = bundledSkill.files.map((f) => f.path);
    const hasAllBundledFiles = bundledPaths.every((path) => storedPaths.has(path));
    if (hasAllBundledFiles) continue;

    await deps.skillService.update(projectId, skill.name, {
      files: bundledSkill.files,
    });

    for (const repo of repos) {
      for (const agent of agents) {
        installSkillToRepo(repo.path, agent.agent_id, skill.name, bundledSkill.files, { overwrite: true });
      }
    }
  }
};

export const ensureSkillsInstalled = async (deps: Deps) => {
  const [projects, agents] = await Promise.all([deps.projectService.list(), deps.agentConfigService.list()]);
  if (projects.length === 0) return;

  for (const project of projects) {
    await hydrateLegacySkillFilesForProject(deps, project.id);
    await syncSingleFileSkillsWithBundledForProject(deps, project.id, agents);
    if (agents.length === 0) continue;
    await installMissingSkillsForProject(deps, project.id, agents);
  }
};
