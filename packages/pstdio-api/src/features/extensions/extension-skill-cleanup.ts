import type { Skill } from "pstdio-api-contracts";
import { catalogNameFromKey } from "../../services/extension-asset-catalog";
import {
  installProjectSkillsToRepos,
  removeProjectSkillsFromRepos,
  type SkillRemovalTarget,
} from "../skills/install-skill-to-repo";
import type { ExtensionsRouteDeps } from "./deps";

type ExtensionSkillOwner = {
  installedSource: {
    extension_id: string;
    manifest_json: unknown;
  };
};

type PrunedExtension = ExtensionSkillOwner;

type SkillRemovalDeps = Pick<ExtensionsRouteDeps, "harnessRegistry" | "repoService">;
type SkillRefreshDeps = Pick<ExtensionsRouteDeps, "harnessRegistry" | "eventBus" | "repoService" | "skillService">;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const manifestSkillKeys = (manifest: unknown) => {
  if (!isRecord(manifest) || !Array.isArray(manifest.skills)) return [];
  return manifest.skills.filter((key): key is string => typeof key === "string" && key.length > 0);
};

const manifestName = (manifest: unknown) =>
  isRecord(manifest) && typeof manifest.name === "string" ? manifest.name : null;

const addTarget = (targets: Map<string, SkillRemovalTarget>, target: SkillRemovalTarget) => {
  const existing = targets.get(target.name);
  if (existing?.files) return;
  targets.set(target.name, target);
};

const skillNameCandidates = (owner: ExtensionSkillOwner, key: string) => {
  const names = new Set<string>();
  names.add(catalogNameFromKey(key));
  names.add(`${owner.installedSource.extension_id}.${key}`);

  const name = manifestName(owner.installedSource.manifest_json);
  if (name) names.add(`${name}.${key}`);

  return names;
};

export const extensionSkillRemovalTargets = (owner: ExtensionSkillOwner, skills: Skill[] = []) => {
  const targets = new Map<string, SkillRemovalTarget>();

  for (const skill of skills) {
    addTarget(targets, { name: skill.name, files: skill.files });
    if (!skill.key) continue;
    for (const name of skillNameCandidates(owner, skill.key)) addTarget(targets, { name });
  }

  for (const key of manifestSkillKeys(owner.installedSource.manifest_json)) {
    for (const name of skillNameCandidates(owner, key)) addTarget(targets, { name });
  }

  return [...targets.values()];
};

export const removeExtensionSkillsFromRepos = async (
  deps: SkillRemovalDeps,
  input: { owner: ExtensionSkillOwner; projectId: string; skills?: Skill[] },
) => {
  await removeProjectSkillsFromRepos(deps, {
    projectId: input.projectId,
    skills: extensionSkillRemovalTargets(input.owner, input.skills),
  });
};

export const removePrunedExtensionSkillsFromRepos = async (
  deps: SkillRemovalDeps,
  input: { projectId: string; pruned: PrunedExtension[] },
) => {
  const skills = input.pruned.flatMap((owner) => extensionSkillRemovalTargets(owner));
  await removeProjectSkillsFromRepos(deps, { projectId: input.projectId, skills });
};

export const refreshProjectSkillsInRepos = async (deps: SkillRefreshDeps, projectId: string) => {
  await installProjectSkillsToRepos(deps, { projectId });
};
