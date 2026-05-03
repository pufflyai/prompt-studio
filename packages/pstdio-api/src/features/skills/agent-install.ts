import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { findAgent, type KnownAgent } from "pstdio-agents";
import type { SkillFile } from "pstdio-api-contracts";
import { resolvePackageAsset } from "pstdio-extensions";
import type { RuntimeSkillRecord } from "pstdio-extensions/types";
import type { RouteDeps } from "../deps";
import { parseProjectSelectedAgents } from "../projects/selected-agents";

const MARKER_FILE = ".pstdio-extension-skill.json";

type AgentConfigRecord = {
  agent_id: string;
  config: string;
};

type SkillInstallTarget = {
  agentId: string;
  skillsDir: string;
};

const parseAgentConfig = (config: string) => {
  try {
    const parsed = JSON.parse(config);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as { skills_dir?: unknown })
      : {};
  } catch {
    return {};
  }
};

const resolveSkillsDir = (agent: KnownAgent, config: AgentConfigRecord) => {
  const parsed = parseAgentConfig(config.config);
  return typeof parsed.skills_dir === "string" && parsed.skills_dir.trim().length > 0
    ? parsed.skills_dir
    : agent.skillsDir;
};

const selectedAgentConfigs = async (deps: RouteDeps, projectId: string) => {
  const project = await deps.projectService.get(projectId);
  if (!project) return [];

  const selected = parseProjectSelectedAgents(project);
  const selectedIds = selected.length > 0 ? new Set(selected) : null;
  const configs = await deps.agentConfigService.list();

  return configs.filter((config) => !selectedIds || selectedIds.has(config.agent_id));
};

const skillInstallDirName = (record: RuntimeSkillRecord) => `${record.namespace}.${record.localId}`;

const readSkillFiles = (record: RuntimeSkillRecord): SkillFile[] => {
  const asset = resolvePackageAsset(record.contribution.source, {
    sourcePath: record.sourcePath,
    allowDirectory: true,
  });

  if (asset.kind === "file") {
    return [
      {
        path: "SKILL.md",
        content: readFileSync(asset.path, "utf8"),
        encoding: "utf8",
      },
    ];
  }

  const files: SkillFile[] = [];
  const walk = (dir: string) => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      files.push({
        path: relative(asset.path, full).replaceAll("\\", "/"),
        content: readFileSync(full, "utf8"),
        encoding: "utf8",
      });
    }
  };

  walk(asset.path);
  return files;
};

const isInside = (root: string, candidate: string) => {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

const markerContent = (record: RuntimeSkillRecord) =>
  `${JSON.stringify({ extensionId: record.extensionId, skillKey: record.localId }, null, 2)}\n`;

const markerMatches = (targetDir: string, record: RuntimeSkillRecord) => {
  const markerPath = join(targetDir, MARKER_FILE);
  if (!existsSync(markerPath)) return false;

  try {
    const parsed = JSON.parse(readFileSync(markerPath, "utf8"));
    return parsed.extensionId === record.extensionId && parsed.skillKey === record.localId;
  } catch {
    return false;
  }
};

const writeSkillFiles = (targetDir: string, record: RuntimeSkillRecord, files: SkillFile[]) => {
  if (existsSync(targetDir) && !markerMatches(targetDir, record)) return false;

  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });

  for (const file of files) {
    const targetPath = resolve(targetDir, ...file.path.split(/[\\/]+/u).filter(Boolean));
    if (!isInside(targetDir, targetPath)) continue;
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, file.content);
  }

  writeFileSync(join(targetDir, MARKER_FILE), markerContent(record));
  return true;
};

const resolveInstallTargets = (configs: AgentConfigRecord[]): SkillInstallTarget[] => {
  const targets: SkillInstallTarget[] = [];
  for (const config of configs) {
    const agent = findAgent(config.agent_id);
    if (!agent) continue;
    targets.push({ agentId: config.agent_id, skillsDir: resolveSkillsDir(agent, config) });
  }
  return targets;
};

export const installExtensionSkillForProject = async (
  deps: RouteDeps,
  projectId: string,
  record: RuntimeSkillRecord,
) => {
  const repos = await deps.repoService.listByProject(projectId);
  if (repos.length === 0) return [];

  const configs = await selectedAgentConfigs(deps, projectId);
  const targets = resolveInstallTargets(configs);
  const files = readSkillFiles(record);
  const installed = new Set<string>();
  const dirName = skillInstallDirName(record);

  for (const repo of repos) {
    for (const target of targets) {
      const targetDir = join(repo.path, target.skillsDir, dirName);
      if (writeSkillFiles(targetDir, record, files)) installed.add(target.agentId);
    }
  }

  return [...installed].sort();
};

export const installExtensionSkillsForProject = async (
  deps: RouteDeps,
  projectId: string,
  records: RuntimeSkillRecord[],
) => {
  const result = new Map<string, string[]>();
  for (const record of records) {
    result.set(record.id, await installExtensionSkillForProject(deps, projectId, record));
  }
  return result;
};

export const listInstalledAgentsForExtensionSkill = async (
  deps: RouteDeps,
  projectId: string,
  record: RuntimeSkillRecord,
) => {
  const repos = await deps.repoService.listByProject(projectId);
  if (repos.length === 0) return [];

  const configs = await selectedAgentConfigs(deps, projectId);
  const targets = resolveInstallTargets(configs);
  const dirName = skillInstallDirName(record);
  const installed = new Set<string>();

  for (const repo of repos) {
    for (const target of targets) {
      const targetDir = join(repo.path, target.skillsDir, dirName);
      if (existsSync(targetDir) && statSync(targetDir).isDirectory() && markerMatches(targetDir, record)) {
        installed.add(target.agentId);
      }
    }
  }

  return [...installed].sort();
};
