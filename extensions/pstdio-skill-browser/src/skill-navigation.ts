import { l10n, type NavigationTarget, type ResourceRef, type TreeViewSection } from "@pstdio/sdk/extensions";
import type { Skill } from "@pstdio/sdk/resources";

export const skillNavigation = (
  skills: Skill[],
  extensions: { extensionId: string; displayName: string }[],
  target: (skill: Skill) => { resource: ResourceRef; target: NavigationTarget },
) => {
  const names = new Map(extensions.map((extension) => [extension.extensionId, extension.displayName]));
  const sections = new Map<string, TreeViewSection>();
  for (const skill of skills) {
    const owner = skill.extension_id ?? "project";
    let section = sections.get(owner);
    if (!section) {
      section = { id: owner, label: names.get(owner) ?? skill.install_name ?? owner, collapsible: false, nodes: [] };
      if (skill.source_kind === "project") section.label = l10n("skills.project", "Project");
      sections.set(owner, section);
    }
    section.nodes.push({ id: skill.name, label: skill.title || skill.name, icon: "sparkles", ...target(skill) });
  }
  return [...sections.values()];
};
