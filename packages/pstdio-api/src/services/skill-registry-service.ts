import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeSkill } from "@pstdio/sdk/extensions";
import { findAgent, getBundledSkills } from "pstdio-agents";
import {
  type createExtensionInstancesDBService,
  createExtensionSkillPreferencesDBService,
  type DbClient,
} from "pstdio-db";
import { readPackageAssetText } from "pstdio-extensions";
import type { EventBus } from "../features/sync/event-bus";
import type { createAgentConfigService } from "./agent-config-service";
import { findExtensionSourcePath, loadProjectExtensionRuntime } from "./extension-registry-runtime";
import type { createRepoService } from "./repo-service";
import type { createSkillService } from "./skill-service";

type SkillFile = {
  path: string;
  content: string;
  encoding: "utf8";
};

type SkillRegistryServiceDeps = {
  agentConfigService: ReturnType<typeof createAgentConfigService>;
  db: DbClient;
  eventBus: EventBus;
  extensionInstancesDBService: ReturnType<typeof createExtensionInstancesDBService>;
  filesRoot: string;
  repoService: ReturnType<typeof createRepoService>;
  skillService: ReturnType<typeof createSkillService>;
};

type UpdateSkillInput = {
  description?: string;
  files?: SkillFile[];
};

const defaultTimestamp = "1970-01-01T00:00:00.000Z";

const toProjectSkill = (skill: Awaited<ReturnType<ReturnType<typeof createSkillService>["list"]>>[number]) => ({
  ...skill,
  source_kind: "project" as const,
  read_only: false,
});

const toExtensionSkill = (projectId: string, skill: RuntimeSkill, files: SkillFile[] = []) => ({
  id: skill.id,
  project_id: projectId,
  name: skill.id,
  description: skill.description ?? "",
  files,
  source_kind: "extension-default" as const,
  read_only: true,
  title: skill.title,
  origin_extension_id: skill.extensionId,
  origin_skill_key: skill.key,
  created_at: defaultTimestamp,
  updated_at: defaultTimestamp,
  deleted_at: null,
});

const slugify = (value: string) => {
  const slug = value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "extension-skill";
};

export const createSkillRegistryService = (deps: SkillRegistryServiceDeps) => {
  const preferences = createExtensionSkillPreferencesDBService(deps.db);
  const runtimeCache = new Map<string, Awaited<ReturnType<typeof loadProjectExtensionRuntime>>>();
  const runtimeDeps = {
    extensionInstancesDBService: deps.extensionInstancesDBService,
    filesRoot: deps.filesRoot,
    repoService: deps.repoService,
  };

  const loadRuntime = async (projectId: string) => {
    const [repo] = await deps.repoService.listByProject(projectId);
    const cacheKey = `${projectId}:${repo?.path ?? ""}`;
    const cached = runtimeCache.get(cacheKey);
    if (cached) return cached;

    const runtime = await loadProjectExtensionRuntime(runtimeDeps, projectId);
    runtimeCache.set(cacheKey, runtime);
    return runtime;
  };

  const readSkillFiles = async (
    runtime: Awaited<ReturnType<typeof loadProjectExtensionRuntime>>,
    skill: RuntimeSkill,
  ) => {
    const sourcePath = findExtensionSourcePath(runtime, skill.extensionId);
    if (!sourcePath) throw new Error(`Extension source not found: ${skill.extensionId}`);
    const content = await readPackageAssetText(skill.source, { sourcePath });
    return [{ path: "SKILL.md", content, encoding: "utf8" as const }];
  };

  const installedAgents = async (projectId: string, skillName: string) => {
    const [repos, agents] = await Promise.all([
      deps.repoService.listByProject(projectId),
      deps.agentConfigService.list(),
    ]);

    return agents
      .filter((agent) => {
        const knownAgent = findAgent(agent.agent_id);
        if (!knownAgent) return false;
        return repos.some((repo) => existsSync(join(repo.path, knownAgent.skillsDir, skillName, "SKILL.md")));
      })
      .map((agent) => agent.agent_id);
  };

  const bundledVersion = async (skillName: string) => {
    const bundled = await getBundledSkills();
    return bundled.find((skill) => skill.name === skillName)?.version ?? "";
  };

  const getExtensionSkill = async (
    projectId: string,
    name: string,
    options: { includeDisabledPreference?: boolean } = {},
  ) => {
    const runtime = await loadRuntime(projectId);
    const skill = runtime.skills.find((candidate) => candidate.id === name);
    if (!skill) return null;

    if (!options.includeDisabledPreference) {
      const enabled = await preferences.isEnabled(projectId, skill.extensionId, skill.key);
      if (!enabled) return null;
    }

    return { runtime, skill };
  };

  const list = async (projectId: string) => {
    const [projectSkills, runtime] = await Promise.all([deps.skillService.list(projectId), loadRuntime(projectId)]);
    const skills: Array<ReturnType<typeof toProjectSkill> | ReturnType<typeof toExtensionSkill>> =
      projectSkills.map(toProjectSkill);

    for (const skill of runtime.skills) {
      const enabled = await preferences.isEnabled(projectId, skill.extensionId, skill.key);
      if (!enabled) continue;

      skills.push(toExtensionSkill(projectId, skill, await readSkillFiles(runtime, skill)));
    }

    return skills.sort((a, b) => a.name.localeCompare(b.name));
  };

  const get = async (projectId: string, name: string) => {
    const projectSkill = await deps.skillService.getByName(projectId, name);
    if (projectSkill) {
      return {
        ...toProjectSkill(projectSkill),
        bundled_version: await bundledVersion(projectSkill.name),
        installed_agents: await installedAgents(projectId, projectSkill.name),
      };
    }

    const found = await getExtensionSkill(projectId, name);
    if (!found) return null;

    return {
      ...toExtensionSkill(projectId, found.skill, await readSkillFiles(found.runtime, found.skill)),
      bundled_version: "",
      installed_agents: await installedAgents(projectId, found.skill.id),
    };
  };

  const findExtensionDefault = (projectId: string, name: string) =>
    getExtensionSkill(projectId, name, { includeDisabledPreference: true });

  const setDefaultEnabled = async (projectId: string, name: string, enabled: boolean) => {
    const found = await findExtensionDefault(projectId, name);
    if (!found) return null;

    const record = await preferences.setEnabled(projectId, found.skill.extensionId, found.skill.key, enabled);
    deps.eventBus.emit("extension_skill_preferences", "set", record);
    return toExtensionSkill(projectId, found.skill);
  };

  const copyDefault = async (projectId: string, name: string, input: { name?: string } = {}) => {
    const found = await findExtensionDefault(projectId, name);
    if (!found) return { error: "not_found" as const };

    const copyName = input.name ?? slugify(found.skill.title || found.skill.key);
    const existing = await deps.skillService.getByName(projectId, copyName);
    if (existing) return { error: "conflict" as const };

    const copied = await deps.skillService.create({
      project_id: projectId,
      name: copyName,
      description: found.skill.description ?? "",
      files: await readSkillFiles(found.runtime, found.skill),
      origin_extension_id: found.skill.extensionId,
      origin_skill_key: found.skill.key,
    });

    deps.eventBus.emit("skills", "set", copied);

    return { skill: toProjectSkill(copied) };
  };

  const update = async (projectId: string, name: string, input: UpdateSkillInput) => {
    const projectSkill = await deps.skillService.getByName(projectId, name);
    if (!projectSkill) {
      const extensionDefault = await getExtensionSkill(projectId, name);
      return extensionDefault ? { error: "read_only" as const } : { error: "not_found" as const };
    }

    const updated = await deps.skillService.update(projectId, name, input);
    if (!updated) return { error: "not_found" as const };

    deps.eventBus.emit("skills", "set", updated);
    return { skill: toProjectSkill(updated) };
  };

  return { copyDefault, findExtensionDefault, get, list, setDefaultEnabled, update };
};
