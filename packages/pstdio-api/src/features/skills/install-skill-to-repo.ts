import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir as defaultHomedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { SkillFile } from "pstdio-api-contracts";
import { findAgent } from "pstdio-api-contracts/known-agents";
import { listSkillAgentIds } from "../harnesses/skill-agents";
import type { SkillsRouteDeps } from "./deps";

type InstallSkillOptions = {
  homedir?: string;
  overwrite?: boolean;
};

export type SkillRemovalTarget = {
  files?: SkillFile[];
  name: string;
};

type PathOps = {
  isAbsolute: typeof isAbsolute;
  relative: typeof relative;
  resolve: typeof resolve;
};

export const resolveSafeSkillFilePath = (
  skillDir: string,
  filePath: string,
  pathOps: PathOps = { isAbsolute, relative, resolve },
) => {
  if (pathOps.isAbsolute(filePath)) {
    throw new Error(`Invalid skill file path: ${filePath}`);
  }

  const skillRoot = pathOps.resolve(skillDir);
  const resolved = pathOps.resolve(skillRoot, filePath);
  const rel = pathOps.relative(skillRoot, resolved);
  if (rel === "" || (!rel.startsWith("..") && !pathOps.isAbsolute(rel))) {
    return resolved;
  }

  throw new Error(`Invalid skill file path: ${filePath}`);
};

export const installSkillToRepo = (
  repoPath: string,
  agentId: string,
  skillName: string,
  files: SkillFile[],
  options?: InstallSkillOptions,
) => {
  const agent = findAgent(agentId);
  if (!agent) return;

  const dir = join(repoPath, agent.skillsDir, skillName);
  const hasLocalCopy = existsSync(dir);
  if (hasLocalCopy && !options?.overwrite) return;

  const homedir = options?.homedir ?? defaultHomedir();
  const globalDir = join(homedir, agent.globalSkillsDir, skillName);
  if (existsSync(globalDir) && !hasLocalCopy) return;

  const resolvedFiles = files.map((file) => ({
    ...file,
    resolvedPath: resolveSafeSkillFilePath(dir, file.path),
  }));

  if (hasLocalCopy && options?.overwrite) {
    rmSync(dir, { recursive: true, force: true });
  }

  mkdirSync(dir, { recursive: true });

  for (const file of resolvedFiles) {
    mkdirSync(dirname(file.resolvedPath), { recursive: true });
    writeFileSync(file.resolvedPath, file.content, "utf8");
  }
};

const sortSkillFiles = (files: SkillFile[]) =>
  [...files].sort((a, b) => {
    if (a.path === "SKILL.md") return -1;
    if (b.path === "SKILL.md") return 1;
    return a.path.localeCompare(b.path);
  });

const readSkillTree = (rootPath: string, currentPath = rootPath): SkillFile[] => {
  const entries = readdirSync(currentPath, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files: SkillFile[] = [];

  for (const entry of entries) {
    const entryPath = join(currentPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...readSkillTree(rootPath, entryPath));
      continue;
    }
    if (!entry.isFile()) continue;

    files.push({
      path: relative(rootPath, entryPath).replaceAll("\\", "/"),
      content: readFileSync(entryPath, "utf8"),
      encoding: "utf8",
    });
  }

  return sortSkillFiles(files);
};

const hasExpectedSkillTree = (dir: string, files: SkillFile[]) => {
  const actual = readSkillTree(dir);
  const expected = sortSkillFiles(files);
  if (actual.length !== expected.length) return false;

  return expected.every((file, index) => {
    const installed = actual[index];
    return installed?.path === file.path && installed.content === file.content && installed.encoding === file.encoding;
  });
};

export const removeSkillFromRepo = (repoPath: string, agentId: string, skillName: string, files?: SkillFile[]) => {
  const agent = findAgent(agentId);
  if (!agent) return false;

  const dir = join(repoPath, agent.skillsDir, skillName);
  if (!existsSync(dir)) return false;
  if (files && !hasExpectedSkillTree(dir, files)) return false;

  rmSync(dir, { recursive: true, force: true });
  return true;
};

export const removeProjectSkillsFromRepos = async (
  deps: Pick<SkillsRouteDeps, "harnessRegistry" | "repoService">,
  input: { projectId: string; skills: SkillRemovalTarget[] },
) => {
  if (input.skills.length === 0) return [];

  const [repos, agentIds] = await Promise.all([
    deps.repoService.listByProject(input.projectId),
    listSkillAgentIds(deps.harnessRegistry),
  ]);
  const removed: Array<{ agentId: string; repoPath: string; skillName: string }> = [];

  for (const repo of repos) {
    for (const agentId of agentIds) {
      for (const skill of input.skills) {
        if (!removeSkillFromRepo(repo.path, agentId, skill.name, skill.files)) continue;
        removed.push({ agentId, repoPath: repo.path, skillName: skill.name });
      }
    }
  }

  return removed;
};

export const installProjectSkillsToRepo = async (
  deps: Pick<SkillsRouteDeps, "skillService" | "harnessRegistry" | "eventBus">,
  input: { projectId: string; repoPath: string },
) => {
  const [skills, agentIds] = await Promise.all([
    deps.skillService.list(input.projectId),
    listSkillAgentIds(deps.harnessRegistry),
  ]);

  for (const skill of skills) {
    if (skill.files.length === 0) continue;

    for (const agentId of agentIds) {
      installSkillToRepo(input.repoPath, agentId, skill.name, skill.files);
    }
  }
};

export const installProjectSkillsToRepos = async (
  deps: Pick<SkillsRouteDeps, "skillService" | "harnessRegistry" | "eventBus" | "repoService">,
  input: { projectId: string },
) => {
  const repos = await deps.repoService.listByProject(input.projectId);

  for (const repo of repos) {
    await installProjectSkillsToRepo(deps, { projectId: input.projectId, repoPath: repo.path });
  }
};
