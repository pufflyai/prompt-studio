import type {
  ExtensionDiagnostic,
  RuntimeHarnessProvider,
  RuntimeSkill,
  RuntimeTemplate,
  RuntimeTemplateType,
} from "@pstdio/sdk/extensions";
import { isPackageAssetDescriptor } from "./asset-validation";
import { createErrorDiagnostic } from "./diagnostics";
import type { LoadedExtensionSource } from "./loader";
import { PackageAssetError, resolvePackageAssetPath } from "./package-assets";

type ContentRuntime = {
  templateTypes: RuntimeTemplateType[];
  templates: RuntimeTemplate[];
  skills: RuntimeSkill[];
  harnesses: RuntimeHarnessProvider[];
  diagnostics: ExtensionDiagnostic[];
};

const packageAssetDiagnostic = (
  source: LoadedExtensionSource,
  key: string,
  kind: "Template" | "Skill",
  error: string,
) =>
  createErrorDiagnostic({
    code: "invalid_package_asset",
    message: `${kind} "${source.definition.id}.${key}" ${error}`,
    extensionId: source.definition.id,
    sourcePath: source.sourcePath,
  });

const validatePackageAsset = (
  source: LoadedExtensionSource,
  key: string,
  kind: "Template" | "Skill",
  value: unknown,
) => {
  if (!isPackageAssetDescriptor(value)) {
    return packageAssetDiagnostic(source, key, kind, "must use packageAsset(...)");
  }

  try {
    resolvePackageAssetPath(value, { sourcePath: source.sourcePath });
    return null;
  } catch (error) {
    if (error instanceof PackageAssetError) {
      return packageAssetDiagnostic(source, key, kind, error.message);
    }

    throw error;
  }
};

export const registerTemplates = (source: LoadedExtensionSource, runtime: ContentRuntime) => {
  const extensionId = source.definition.id;
  for (const [key, templateType] of Object.entries(source.definition.templateTypes ?? {})) {
    runtime.templateTypes.push({ ...templateType, id: `${extensionId}.${key}`, key, extensionId });
  }

  for (const [key, template] of Object.entries(source.definition.templates ?? {})) {
    const diagnostic = validatePackageAsset(source, key, "Template", template.source);
    if (diagnostic) {
      runtime.diagnostics.push(diagnostic);
      continue;
    }

    runtime.templates.push({
      id: `${extensionId}.${key}`,
      key,
      extensionId,
      title: template.title,
      type: template.type,
      source: template.source,
      description: template.description,
      readOnly: true,
    });
  }
};

export const registerSkills = (source: LoadedExtensionSource, runtime: ContentRuntime) => {
  const extensionId = source.definition.id;
  for (const [key, skill] of Object.entries(source.definition.skills ?? {})) {
    const diagnostic = validatePackageAsset(source, key, "Skill", skill.source);
    if (diagnostic) {
      runtime.diagnostics.push(diagnostic);
      continue;
    }

    runtime.skills.push({ ...skill, id: `${extensionId}.${key}`, key, extensionId, readOnly: true });
  }
};

export const registerHarnesses = (source: LoadedExtensionSource, runtime: ContentRuntime) => {
  const extensionId = source.definition.id;
  for (const [key, harness] of Object.entries(source.definition.harnesses ?? {})) {
    if (typeof harness.label !== "string" || typeof harness.start !== "function") {
      runtime.diagnostics.push(
        createErrorDiagnostic({
          code: "invalid_harness",
          message: `Harness "${extensionId}.${key}" must define label and start(ctx, input)`,
          extensionId,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }

    runtime.harnesses.push({ ...harness, id: harness.id ?? `${extensionId}.${key}`, key, extensionId });
  }
};
