import type { Skill } from "pstdio-api-contracts";
import {
  type ProjectExtensionRuntimeSnapshot,
  resolveEnabledSourceForRecord,
} from "../features/extensions/project-extension-runtime-snapshot";
import {
  catalogId,
  catalogNameFromKey,
  isPackageAssetDescriptor,
  isRecord,
  readSkillPackageAssetFiles,
  sourceRootForAsset,
} from "./extension-asset-catalog";
import type { SkillServiceDeps } from "./skill-service";
export type InternalSkill = Skill & { source_path?: string };
export type ExtensionSkillMetadata = Omit<InternalSkill, "files">;
type EnabledExtensionSource = ProjectExtensionRuntimeSnapshot["enabledSources"][number];
type ExtensionSkillPreference = Awaited<
  ReturnType<SkillServiceDeps["extensionSkillPreferencesDBService"]["list"]>
>[number];

const preferenceKey = (extensionInstanceId: string, key: string) => `${extensionInstanceId}:${key}`;

const extensionSkillTitle = (
  contribution: Record<string, unknown>,
  pref: ExtensionSkillPreference | undefined,
  key: string,
) =>
  pref?.display_name_override ??
  (typeof contribution.title === "string" ? contribution.title : catalogNameFromKey(key));

const extensionSkillDescription = (contribution: Record<string, unknown>, pref: ExtensionSkillPreference | undefined) =>
  pref?.description_override ?? (typeof contribution.description === "string" ? contribution.description : "");

const toExtensionSkill = (input: {
  contribution: unknown;
  includeDisabled: boolean;
  installedSource: EnabledExtensionSource["installedSource"];
  instance: EnabledExtensionSource["instance"];
  key: string;
  pref: ExtensionSkillPreference | undefined;
  projectId: string;
}) => {
  if (!isRecord(input.contribution) || !isPackageAssetDescriptor(input.contribution.source)) return null;

  const enabled = input.pref?.enabled ?? true;
  if (!enabled && !input.includeDisabled) return null;

  const name = catalogNameFromKey(input.key);

  return {
    id: catalogId({ sourceKind: "skill", extensionInstanceId: input.instance.id, key: input.key }),
    project_id: input.projectId,
    source_kind: "extension",
    extension_instance_id: input.instance.id,
    extension_id: input.installedSource.extension_id,
    installed_extension_id: input.installedSource.id,
    install_name: input.installedSource.install_name,
    key: input.key,
    name,
    title: extensionSkillTitle(input.contribution, input.pref, input.key),
    description: extensionSkillDescription(input.contribution, input.pref),
    source: input.contribution.source,
    enabled,
    editable: true,
    created_at: input.instance.created_at,
    updated_at: input.instance.updated_at,
    deleted_at: null,
    source_path: input.installedSource.source_path,
  } satisfies ExtensionSkillMetadata;
};

export const listExtensionSkills = async (
  deps: SkillServiceDeps,
  projectId: string,
  input: { includeDisabled: boolean },
) => {
  const [snapshot, preferences] = await Promise.all([
    deps.extensionRuntimeCatalog.get(projectId),
    deps.extensionSkillPreferencesDBService.list(projectId),
  ]);
  const preferenceByKey = new Map(
    preferences.map((pref) => [preferenceKey(pref.extension_instance_id, pref.skill_key), pref]),
  );
  const items: ExtensionSkillMetadata[] = [];

  for (const skill of snapshot.runtime.skills) {
    const source = resolveEnabledSourceForRecord(skill.sourcePath, snapshot.enabledSources);
    if (!source) continue;

    const item = toExtensionSkill({
      contribution: skill.contribution,
      includeDisabled: input.includeDisabled,
      installedSource: source.installedSource,
      instance: source.instance,
      key: skill.localId,
      pref: preferenceByKey.get(preferenceKey(source.instance.id, skill.localId)),
      projectId,
    });
    if (item) items.push(item);
  }

  return items;
};

export const hydrateExtensionSkill = (skill: ExtensionSkillMetadata): InternalSkill => ({
  ...skill,
  files: readSkillPackageAssetFiles(sourceRootForAsset(skill.source_path!), skill.source!),
});
