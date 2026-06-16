type MergeableTemplate = { name: string; template_type: string; is_default?: boolean };

const typeNameKey = (template: MergeableTemplate) => `${template.template_type}:${template.name}`;

// Project templates override same-named extension contributions. The shadowed
// extension entry is dropped (not just out-sorted) so by-name resolution stays
// deterministic, and a default carried by that extension template follows the
// name onto the overriding project template — defaults are type-scoped, so the
// flag only transfers when both type and name match.
export const mergeProjectAndExtensionTemplates = <T extends MergeableTemplate>(
  projectTemplates: T[],
  extensionTemplates: T[],
) => {
  const projectNames = new Set(projectTemplates.map((template) => template.name));
  const shadowedDefaultKeys = new Set(
    extensionTemplates.filter((template) => template.is_default && projectNames.has(template.name)).map(typeNameKey),
  );
  const resolvedProjectTemplates = projectTemplates.map((template) =>
    shadowedDefaultKeys.has(typeNameKey(template)) ? { ...template, is_default: true } : template,
  );
  const survivingExtensionTemplates = extensionTemplates.filter((template) => !projectNames.has(template.name));

  return [...resolvedProjectTemplates, ...survivingExtensionTemplates].sort((a, b) => a.name.localeCompare(b.name));
};
