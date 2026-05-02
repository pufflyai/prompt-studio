import { isPackageAssetDescriptor } from "../../artifacts/asset-validation";
import type {
  NormalizedExtension,
  RuntimeSkillRecord,
  RuntimeTemplateRecord,
  RuntimeTemplateTypeRecord,
} from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord } from "./accumulator";

export const registerContent = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
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
    runtime.templates.push({
      id: `${ext.namespace}.${localId}`,
      localId,
      extensionId: ext.id,
      namespace: ext.namespace,
      sourcePath: source.sourcePath,
      contribution: template as RuntimeTemplateRecord["contribution"],
    });
  }

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
