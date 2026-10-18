import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir as defaultHomedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { type AgentInfo, harnessLocalId } from "@pstdio/sdk/resources";
import { resolveApiUrl } from "@/features/api-url";
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
  /** Replace existing folders of enabled skills, discarding local edits in them. */
  force?: boolean;
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

  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });

  for (const file of resolvedFiles) {
    mkdirSync(dirname(file.resolvedPath), { recursive: true });
    writeFileSync(file.resolvedPath, file.content, "utf8");
  }
};

/**
 * Copy the project's enabled extension and project skills into an agent skill folder. Those skills are the
 * source and these folders are copies. An existing folder may hold local edits or a skill the user wrote
 * with the same name, so it is kept unless `force` asks to replace it.
 */
export const installSkillsForAgent = async (options: InstallSkillsOptions) => {
  const {
    root,
    agentId,
    projectId,
    global: isGlobal = false,
    homedir = defaultHomedir(),
    baseUrl = resolveApiUrl(),
    force = false,
  } = options;
  const result = { installed: [] as string[], kept: [] as string[], replaced: [] as string[] };
  if (!projectId) return result;

  const agent = findAgentInfo(await listAvailableAgents(baseUrl), agentId);
  if (!agent) {
    throw new Error(`No installed harness found for agent: ${agentId}`);
  }
  if (!agent.skills) return result;

  const targetDir = isGlobal ? join(homedir, agent.skills.global_dir) : join(root, agent.skills.dir);

  for (const skill of await listSkillsWithFiles(projectId)) {
    const dest = resolveSafeSkillDir(targetDir, skill.name);
    if (!existsSync(dest)) {
      writeSkillTree(dest, skill.files);
      result.installed.push(skill.name);
    } else if (force) {
      writeSkillTree(dest, skill.files);
      result.replaced.push(skill.name);
    } else {
      result.kept.push(skill.name);
    }
  }

  return result;
};

/** Lines that tell the user what an install did and how to replace kept folders. */
export const describeSkillInstall = (
  result: Awaited<ReturnType<typeof installSkillsForAgent>>,
  target: { agentId: string; global: boolean },
) => {
  const globalFlag = target.global ? " --global-skills" : "";
  const lines: string[] = [];
  if (result.installed.length > 0) {
    lines.push(`Installed ${result.installed.length} skill(s): ${result.installed.join(", ")}`);
  }
  if (result.replaced.length > 0) {
    lines.push(`Replaced ${result.replaced.length} skill(s): ${result.replaced.join(", ")}`);
  }
  if (result.kept.length > 0) {
    lines.push(
      `Kept ${result.kept.length} existing skill folder(s) unchanged: ${result.kept.join(", ")}`,
      `Run \`pst agents install-skills ${target.agentId}${globalFlag} --force\` to replace them with the current version. This discards local edits in those folders.`,
    );
  }
  if (lines.length === 0) lines.push("No skills to install.");
  return lines;
};
