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

const registerTemplateTypes = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  for (const [localId, type] of Object.entries(source.definition.templateTypes ?? {})) {
    if (!isRecord(type) || typeof type.label !== "string") continue;
    runtime.templateTypes.push({
      id: `${ext.namespace}.${localId}`,
      localId,
      extensionId: ext.id,
      namespace: ext.namespace,
      sourcePath: source.sourcePath,
      contribution: type as RuntimeTemplateTypeRecord["contribution"],
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
          message: `Template "${ext.namespace}.${localId}" asset is unavailable: ${error.message}`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
    }
  }
};

const registerTemplates = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const seen = new Set<string>();

  for (const [localId, template] of Object.entries(source.definition.templates ?? {})) {
    if (!isRecord(template) || typeof template.title !== "string" || typeof template.type !== "string") continue;
    if (!isPackageAssetDescriptor(template.source)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_template_asset",
          message: `Template "${ext.namespace}.${localId}" must declare source via packageAsset()`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }
    if (seen.has(localId)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "duplicate_template_key",
          message: `Extension "${ext.id}" declares template key "${localId}" more than once`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }
    seen.add(localId);

    checkTemplateAssetExists(ext, source, runtime, localId, template);

    runtime.templates.push({
      id: `${ext.namespace}.${localId}`,
      localId,
      extensionId: ext.id,
      namespace: ext.namespace,
      sourcePath: source.sourcePath,
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
          message: `Skill "${ext.namespace}.${localId}" asset is unavailable: ${error.message}`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
    }
  }
};

const registerSkills = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const seen = new Set<string>();

  for (const [localId, skill] of Object.entries(source.definition.skills ?? {})) {
    if (!isRecord(skill) || typeof skill.title !== "string") continue;
    if (!isPackageAssetDescriptor(skill.source)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_skill_asset",
          message: `Skill "${ext.namespace}.${localId}" must declare source via packageAsset()`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }
    if (seen.has(localId)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "duplicate_skill_key",
          message: `Extension "${ext.id}" declares skill key "${localId}" more than once`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }
    seen.add(localId);

    checkSkillAssetExists(ext, source, runtime, localId, skill);

    runtime.skills.push({
      id: `${ext.namespace}.${localId}`,
      localId,
      extensionId: ext.id,
      namespace: ext.namespace,
      sourcePath: source.sourcePath,
      contribution: skill as RuntimeSkillRecord["contribution"],
    });
  }
};

export const registerContent = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  registerTemplateTypes(ext, source, runtime);
  registerTemplates(ext, source, runtime);
  registerSkills(ext, source, runtime);
};
