import type { SkillContribution, TemplateContribution, TemplateTypeContribution } from "@pstdio/sdk/extensions";
import { isPackageAssetDescriptor } from "../../artifacts/asset-validation";
import { PackageAssetError, resolvePackageAsset } from "../../artifacts/package-assets";
import type {
  NormalizedExtension,
  RuntimeSkillRecord,
  RuntimeTemplateRecord,
  RuntimeTemplateTypeRecord,
} from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord } from "./accumulator";
import { contributionArray, contributionRecordBase, uniqueContributions } from "./contribution-collection";
import { isLocalizableString } from "./localizable";
import { normalizeContributionRef } from "./references";

const registerTemplateTypes = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "template-type",
    contributions: contributionArray<TemplateTypeContribution>(source.definition.templateTypes),
  });
  for (const type of contributions) {
    const localId = type.id;
    if (!isRecord(type) || !isLocalizableString(type.label)) continue;
    runtime.templateTypes.push({
      ...contributionRecordBase(ext, source, "template-type", localId),
      contribution: {
        ...type,
        ...(type.commands
          ? {
              commands: {
                list: normalizeContributionRef(ext, type.commands.list),
                read: normalizeContributionRef(ext, type.commands.read),
                save: normalizeContributionRef(ext, type.commands.save),
                delete: normalizeContributionRef(ext, type.commands.delete),
              },
            }
          : {}),
      } as RuntimeTemplateTypeRecord["contribution"],
    });
  }
};

const checkTemplateAssetExists = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  localId: string,
  template: { source: unknown },
) => {
  try {
    resolvePackageAsset(template.source as never, { sourcePath: source.sourcePath });
  } catch (error) {
    if (error instanceof PackageAssetError) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "missing_template_asset",
          message: `Template "${ext.name}.${localId}" asset is unavailable: ${error.message}`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
    }
  }
};

const registerTemplates = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "template",
    contributions: contributionArray<TemplateContribution>(source.definition.templates),
  });
  for (const template of contributions) {
    const localId = template.id;
    if (!isRecord(template) || !isLocalizableString(template.title) || typeof template.type !== "string") continue;
    if (!isPackageAssetDescriptor(template.source)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_template_asset",
          message: `Template "${ext.name}.${localId}" must declare source via packageAsset()`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }
    checkTemplateAssetExists(ext, source, runtime, localId, template);

    runtime.templates.push({
      ...contributionRecordBase(ext, source, "template", localId),
      contribution: template as RuntimeTemplateRecord["contribution"],
    });
  }
};

const checkSkillAssetExists = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  localId: string,
  skill: { source: unknown },
) => {
  try {
    resolvePackageAsset(skill.source as never, { sourcePath: source.sourcePath, allowDirectory: true });
  } catch (error) {
    if (error instanceof PackageAssetError) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "missing_skill_asset",
          message: `Skill "${ext.name}.${localId}" asset is unavailable: ${error.message}`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
    }
  }
};

const registerSkills = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "skill",
    contributions: contributionArray<SkillContribution>(source.definition.skills),
  });
  for (const skill of contributions) {
    const localId = skill.id;
    if (!isRecord(skill) || !isLocalizableString(skill.title)) continue;
    if (!isPackageAssetDescriptor(skill.source)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_skill_asset",
          message: `Skill "${ext.name}.${localId}" must declare source via packageAsset()`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }
    checkSkillAssetExists(ext, source, runtime, localId, skill);

    runtime.skills.push({
      ...contributionRecordBase(ext, source, "skill", localId),
      contribution: skill as RuntimeSkillRecord["contribution"],
    });
  }
};

export const registerContent = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  registerTemplateTypes(ext, source, runtime);
  registerTemplates(ext, source, runtime);
  registerSkills(ext, source, runtime);
};
