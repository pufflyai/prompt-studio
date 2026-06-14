import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir as defaultHomedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { type AgentInfo, harnessLocalId } from "@pstdio/sdk/resources";
import { API_URL } from "@/features/api-url";
import { listSkillsWithFiles } from "./api/list-skills";

type SkillFile = {
  path: string;
  content: string;
  encoding: "utf8";
};

type InstallSkillsOptions = {
  root: string;
  agentId: string;
  projectId?: string;
  global?: boolean;
  homedir?: string;
  baseUrl?: string;
};

const listAvailableAgents = async (baseUrl: string, projectId?: string) => {
  return createClient({ baseUrl }).agents.info(projectId ? { project: projectId } : undefined);
};

const findAgentInfo = (agents: AgentInfo[], agentId: string) =>
  agents.find((agent) => agent.id === agentId) ?? agents.find((agent) => harnessLocalId(agent.id) === agentId) ?? null;

type PathOps = {
  isAbsolute: typeof isAbsolute;
  relative: typeof relative;
  resolve: typeof resolve;
};

export const resolveSafeSkillFilePath = (
  targetDir: string,
  filePath: string,
  pathOps: PathOps = { isAbsolute, relative, resolve },
) => {
  if (pathOps.isAbsolute(filePath)) {
    throw new Error(`Invalid skill file path: ${filePath}`);
  }

  const skillRoot = pathOps.resolve(targetDir);
  const resolved = pathOps.resolve(skillRoot, filePath);
  const rel = pathOps.relative(skillRoot, resolved);
  if (rel === "" || (!rel.startsWith("..") && !pathOps.isAbsolute(rel))) {
    return resolved;
  }

  throw new Error(`Invalid skill file path: ${filePath}`);
};

export const resolveSafeSkillDir = (
  skillsRoot: string,
  skillName: string,
  pathOps: PathOps = { isAbsolute, relative, resolve },
) => {
  if (!skillName || skillName.includes("/") || skillName.includes("\\") || pathOps.isAbsolute(skillName)) {
    throw new Error(`Invalid skill name: ${skillName}`);
  }

  const root = pathOps.resolve(skillsRoot);
  const resolved = pathOps.resolve(root, skillName);
  const rel = pathOps.relative(root, resolved);
  if (rel === "" || rel.startsWith("..") || pathOps.isAbsolute(rel)) {
    throw new Error(`Invalid skill name: ${skillName}`);
  }

  return resolved;
};

const writeSkillTree = (targetDir: string, files: SkillFile[]) => {
  const resolvedFiles = files.map((file) => ({
    ...file,
    resolvedPath: resolveSafeSkillFilePath(targetDir, file.path),
  }));

  mkdirSync(targetDir, { recursive: true });

  for (const file of resolvedFiles) {
    mkdirSync(dirname(file.resolvedPath), { recursive: true });
    writeFileSync(file.resolvedPath, file.content, "utf8");
  }
};

export const installSkillsForAgent = async (options: InstallSkillsOptions) => {
  const { root, agentId, projectId, global: isGlobal = false, homedir = defaultHomedir(), baseUrl = API_URL } = options;
  if (!projectId) return [];

  const agent = findAgentInfo(await listAvailableAgents(baseUrl), agentId);
  if (!agent) {
    throw new Error(`No installed harness found for agent: ${agentId}`);
  }
  if (!agent.skills) return [];

  const targetDir = isGlobal ? join(homedir, agent.skills.global_dir) : join(root, agent.skills.dir);

  const skills = await listSkillsWithFiles(projectId);
  const installed: string[] = [];

  for (const skill of skills) {
    const dest = resolveSafeSkillDir(targetDir, skill.name);
    if (existsSync(dest)) continue;

    writeSkillTree(dest, skill.files);
    installed.push(skill.name);
  }

  return installed;
};

export const installDefaultSkills = async (
  root: string,
  projectId: string,
  baseUrl = API_URL,
  homedir = defaultHomedir(),
) => {
  const agents = (await listAvailableAgents(baseUrl, projectId)).filter(
    (agent) => agent.availability.type === "INSTALLED" && agent.skills,
  );
  if (agents.length === 0) return;

  const skills = await listSkillsWithFiles(projectId);

  for (const agent of agents) {
    const localDir = join(root, agent.skills!.dir);
    const globalDir = join(homedir, agent.skills!.global_dir);

    for (const skill of skills) {
      const localDest = resolveSafeSkillDir(localDir, skill.name);
      if (existsSync(localDest)) continue;
      if (existsSync(resolveSafeSkillDir(globalDir, skill.name))) continue;

      writeSkillTree(localDest, skill.files);
    }
  }
};
