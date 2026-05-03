import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { Skill, SkillFile } from "pstdio-api-contracts";
import { type PackageAssetKind, resolvePackageAsset } from "pstdio-extensions";
import type { RuntimeSkillRecord } from "pstdio-extensions/types";
import type { RouteDeps } from "../../deps";

export type ListSkillRegistryOptions = {
  includeDisabledExtensionDefaults?: boolean;
};

export const extensionDefaultSkillId = (extensionId: string, key: string) => `extension:${extensionId}:${key}`;
export const extensionDefaultSkillName = (record: { namespace: string; localId: string }) =>
  `${record.namespace}.${record.localId}`;

const projectRowToSkill = (skill: {
  id: string;
  project_id: string;
  name: string;
  description: string;
  files: SkillFile[];
  origin_extension_id: string | null;
  origin_skill_key: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Skill => ({
  id: skill.id,
  project_id: skill.project_id,
  name: skill.name,
  description: skill.description,
  files: skill.files,
  source_kind: "project",
  read_only: false,
  asset_kind: undefined,
  extension_id: null,
  skill_key: null,
  origin_extension_id: skill.origin_extension_id,
  origin_skill_key: skill.origin_skill_key,
  created_at: skill.created_at,
  updated_at: skill.updated_at,
  deleted_at: skill.deleted_at,
});

const readAssetFiles = (root: string): SkillFile[] => {
  const collected: SkillFile[] = [];
  const walk = (dir: string) => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const rel = relative(root, full)
          .split(/[\\/]+/)
          .join("/");
        collected.push({
          path: rel,
          content: readFileSync(full, "utf8"),
          encoding: "utf8" as const,
        });
      }
    }
  };
  if (statSync(root).isDirectory()) walk(root);
  return collected;
};

export const extensionDefaultToSkill = (record: RuntimeSkillRecord, projectId: string): Skill => {
  let assetKind: PackageAssetKind = "missing";
  let files: SkillFile[] = [];

  try {
    const asset = resolvePackageAsset(record.contribution.source, {
      sourcePath: record.sourcePath,
      allowDirectory: true,
    });
    assetKind = asset.kind;
    if (asset.kind === "file") {
      files = [
        {
          path: "SKILL.md",
          content: readFileSync(asset.path, "utf8"),
          encoding: "utf8" as const,
        },
      ];
    } else {
      files = readAssetFiles(asset.path);
    }
  } catch {
    assetKind = "missing";
    files = [];
  }

  return {
    id: extensionDefaultSkillId(record.extensionId, record.localId),
    project_id: projectId,
    name: extensionDefaultSkillName(record),
    description: record.contribution.description ?? "",
    files,
    source_kind: "extension-default",
    read_only: true,
    asset_kind: assetKind,
    extension_id: record.extensionId,
    skill_key: record.localId,
    origin_extension_id: null,
    origin_skill_key: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    deleted_at: null,
  };
};

export const listSkillRegistry = async (
  deps: RouteDeps,
  projectId: string,
  options: ListSkillRegistryOptions = {},
): Promise<Skill[]> => {
  const checkResult = await deps.extensionService.check();
  const runtimeSkills = checkResult.runtime.skills;

  const extensionItems: Skill[] = [];
  for (const record of runtimeSkills) {
    const enabled = await deps.extensionService.skillPreferences.isEnabled(
      projectId,
      record.extensionId,
      record.localId,
    );
    if (!enabled && !options.includeDisabledExtensionDefaults) continue;
    extensionItems.push(extensionDefaultToSkill(record, projectId));
  }

  const projectSkills = await deps.skillService.list(projectId);
  const projectItems = projectSkills.map(projectRowToSkill);

  return [...extensionItems, ...projectItems];
};
