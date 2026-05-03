import type { Skill, SkillFile } from "pstdio-api-contracts";
import type { RouteDeps } from "../../deps";
import { findExtensionSkill, readExtensionSkillFiles } from "./extension-content";

export type CopyExtensionSkillInput = {
  projectId: string;
  extensionId: string;
  skillKey: string;
  name?: string;
};

export type CopyExtensionSkillResult =
  | { ok: true; skill: Skill }
  | {
      ok: false;
      error: "extension_skill_not_found" | "asset_unreadable" | "name_conflict";
      message: string;
    };

const buildDefaultName = (extensionId: string, skillKey: string) => `${extensionId}.${skillKey}`;

export const copyExtensionSkill = async (
  deps: RouteDeps,
  input: CopyExtensionSkillInput,
): Promise<CopyExtensionSkillResult> => {
  const lookup = await findExtensionSkill(deps, input.extensionId, input.skillKey);
  if (!lookup.ok) {
    return {
      ok: false,
      error: lookup.assetMissing ? "asset_unreadable" : "extension_skill_not_found",
      message: lookup.assetMissing
        ? `Extension skill asset is missing or unreadable: ${input.extensionId}.${input.skillKey}`
        : `Extension skill not found: ${input.extensionId}.${input.skillKey}`,
    };
  }

  let files: SkillFile[];
  try {
    files = await readExtensionSkillFiles(lookup.resolved);
  } catch (error) {
    return {
      ok: false,
      error: "asset_unreadable",
      message: `Cannot read extension skill asset: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const name = input.name ?? buildDefaultName(input.extensionId, input.skillKey);
  const existing = await deps.skillService.getByName(input.projectId, name);
  if (existing) {
    return { ok: false, error: "name_conflict", message: `Skill already exists: ${name}` };
  }

  const description = lookup.resolved.record.contribution.description ?? "";

  const created = await deps.skillService.create({
    project_id: input.projectId,
    name,
    description,
    files,
    origin_extension_id: input.extensionId,
    origin_skill_key: input.skillKey,
  });

  const skill: Skill = {
    id: created.id,
    project_id: created.project_id,
    name: created.name,
    description: created.description,
    files: created.files,
    source_kind: "project",
    read_only: false,
    extension_id: null,
    skill_key: null,
    origin_extension_id: created.origin_extension_id,
    origin_skill_key: created.origin_skill_key,
    created_at: created.created_at,
    updated_at: created.updated_at,
    deleted_at: created.deleted_at,
  };

  deps.eventBus.emit("skills", "set", skill);

  return { ok: true, skill };
};
