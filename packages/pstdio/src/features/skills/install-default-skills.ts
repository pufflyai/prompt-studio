import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir as defaultHomedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { findAgent } from "pstdio-agents";
import { listAgents } from "@/features/agents/api/list-agents";
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
};

type AgentConfig = {
  agent_id: string;
  is_default: boolean;
};

const listAvailableAgents = async (baseUrl: string) => {
  const res = await fetch(`${baseUrl}/v1/agents/info`);
  if (!res.ok) {
    throw new Error(`Failed to list agent info: ${res.status}`);
  }

  return (await res.json()) as { id: string; availability: { type: "INSTALLED" | "NOT_FOUND" } }[];
};

const setupAvailableAgents = async (baseUrl: string, defaultAgentId: string) => {
  const res = await fetch(`${baseUrl}/v1/agents/setup-available`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ default_agent_id: defaultAgentId }),
  });

  if (!res.ok) {
    throw new Error(`Failed to set up available agents: ${res.status}`);
  }

  return (await res.json()) as AgentConfig[];
};

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

const resolveConfiguredAgents = async (baseUrl: string) => {
  const configured = await listAgents();
  if (configured.length > 0) return configured;

  const available = await listAvailableAgents(baseUrl);
  const installed = available.filter((agent) => agent.availability.type === "INSTALLED");
  if (installed.length === 0) return [];

  return setupAvailableAgents(baseUrl, installed[0]!.id);
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
  const { root, agentId, projectId, global: isGlobal = false, homedir = defaultHomedir() } = options;
  const agent = findAgent(agentId);
  if (!agent) return [];
  if (!projectId) return [];

  const targetDir = isGlobal ? join(homedir, agent.globalSkillsDir) : join(root, agent.skillsDir);

  const skills = await listSkillsWithFiles(projectId);
  const installed: string[] = [];

  for (const skill of skills) {
    const dest = join(targetDir, skill.name);
    if (existsSync(dest)) continue;

    writeSkillTree(dest, skill.files);
    installed.push(skill.name);
  }

  return installed;
};

export const removeBundledSkillsForAgent = async (root: string, agentId: string, projectId: string) => {
  const agent = findAgent(agentId);
  if (!agent) return [];

  const skillsDir = join(root, agent.skillsDir);
  const skills = await listSkillsWithFiles(projectId);
  const removed: string[] = [];

  for (const skill of skills) {
    const dest = join(skillsDir, skill.name);
    if (!existsSync(dest)) continue;

    rmSync(dest, { recursive: true, force: true });
    removed.push(skill.name);
  }

  return removed;
};

export const installDefaultSkills = async (
  root: string,
  projectId: string,
  baseUrl = API_URL,
  homedir = defaultHomedir(),
) => {
  const configured = await resolveConfiguredAgents(baseUrl);
  if (configured.length === 0) return;

  const skills = await listSkillsWithFiles(projectId);

  for (const { agent_id } of configured) {
    const agent = findAgent(agent_id);
    if (!agent) continue;

    const localDir = join(root, agent.skillsDir);
    const globalDir = join(homedir, agent.globalSkillsDir);

    for (const skill of skills) {
      const localDest = join(localDir, skill.name);
      if (existsSync(localDest)) continue;
      if (existsSync(join(globalDir, skill.name))) continue;

      writeSkillTree(localDest, skill.files);
    }
  }
};
