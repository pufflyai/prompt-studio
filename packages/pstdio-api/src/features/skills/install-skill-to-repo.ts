import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir as defaultHomedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { SkillFile } from "pstdio-api-contracts";
import { findAgent } from "pstdio-api-contracts/known-agents";
import { setupInstalledAgents } from "../agents/setup-installed-agents";
import type { SkillsRouteDeps } from "./deps";

type InstallSkillOptions = {
  homedir?: string;
  overwrite?: boolean;
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

const resolveTargetAgents = async (
  deps: Pick<SkillsRouteDeps, "agentConfigService" | "agentRegistry" | "eventBus">,
) => {
  const configured = await deps.agentConfigService.list();
  if (configured.length > 0) return configured;

  return setupInstalledAgents(deps);
};

export const installProjectSkillsToRepo = async (
  deps: Pick<SkillsRouteDeps, "skillService" | "agentConfigService" | "fileService" | "agentRegistry" | "eventBus">,
  input: { projectId: string; repoPath: string },
) => {
  const [skills, agents] = await Promise.all([deps.skillService.list(input.projectId), resolveTargetAgents(deps)]);

  for (const skill of skills) {
    const files =
      skill.files.length > 0
        ? skill.files
        : "legacy_file_id" in skill && skill.legacy_file_id
          ? await deps.fileService.get(skill.legacy_file_id).then(async (file) =>
              file
                ? [
                    {
                      path: "SKILL.md",
                      content: await readFile(file.storage_path, "utf8"),
                      encoding: "utf8" as const,
                    },
                  ]
                : [],
            )
          : [];

    if (files.length === 0) continue;

    for (const agent of agents) {
      installSkillToRepo(input.repoPath, agent.agent_id, skill.name, files);
    }
  }
};
