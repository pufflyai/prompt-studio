import type { ResourceRef } from "pstdio-workbench/core";

type StaticWorkbenchSettingsSection = "runtime" | "harnesses" | "extensions" | "repositories" | "danger-zone";

export type WorkbenchSettingsSection =
  | StaticWorkbenchSettingsSection
  | {
      skill: string;
    }
  | {
      template: string;
    };

const projectlessSections = new Set<StaticWorkbenchSettingsSection>(["runtime", "harnesses"]);

const settingsSectionByResourceId: Partial<Record<string, StaticWorkbenchSettingsSection>> = {
  "settings/runtime": "runtime",
  "settings/harnesses": "harnesses",
  "settings/extensions": "extensions",
  "settings/repositories": "repositories",
  "settings/danger-zone": "danger-zone",
};

const decodeResourceSegment = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const resolveDynamicSettingsSection = (resourceId: string): WorkbenchSettingsSection | undefined => {
  const skillPrefix = "settings/skills/";
  if (resourceId.startsWith(skillPrefix)) {
    return { skill: decodeResourceSegment(resourceId.slice(skillPrefix.length)) };
  }

  const templatePrefix = "settings/templates/";
  if (resourceId.startsWith(templatePrefix)) {
    return { template: decodeResourceSegment(resourceId.slice(templatePrefix.length)) };
  }

  return undefined;
};

const isProjectlessSection = (section: WorkbenchSettingsSection) =>
  typeof section === "string" && projectlessSections.has(section);

export const resolveWorkbenchSettingsSection = (resource: ResourceRef | undefined, hasProject: boolean) => {
  const section = resource?.id
    ? (settingsSectionByResourceId[resource.id] ?? resolveDynamicSettingsSection(resource.id))
    : undefined;
  if (!section) return "runtime";
  if (!hasProject && !isProjectlessSection(section)) return "runtime";
  return section;
};
