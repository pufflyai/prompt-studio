type MergeableTemplate = {
  name: string;
  template_type: string;
  title?: string;
  is_default?: boolean;
  extension_id?: string | null;
};

const authoritativeExtensionIds = new Set(["pstdio.pstdio-planner", "pstdio.pstdio-reports", "pstdio.pstdio-skills"]);

// Project templates override same-named extension contributions. The shadowed
// extension entry is dropped (not just out-sorted) so by-name resolution stays
// deterministic, and traits the override is expected to inherit follow the name
// onto it: the extension's display title (project templates otherwise show their
// raw name) and a carried default. The default is type-scoped, so it only
// transfers when both type and name match.
export const mergeProjectAndExtensionTemplates = <T extends MergeableTemplate>(
  projectTemplates: T[],
  extensionTemplates: T[],
) => {
  const authoritativeNames = new Set(
    extensionTemplates
      .filter((template) => authoritativeExtensionIds.has(template.extension_id ?? ""))
      .map((template) => template.name),
  );
  const effectiveProjectTemplates = projectTemplates.filter((template) => !authoritativeNames.has(template.name));
  const projectNames = new Set(effectiveProjectTemplates.map((template) => template.name));
  const shadowedByName = new Map(
    extensionTemplates
      .filter((template) => projectNames.has(template.name))
      .map((template) => [template.name, template]),
  );
  const resolvedProjectTemplates = effectiveProjectTemplates.map((template) => {
    const shadowed = shadowedByName.get(template.name);
    if (!shadowed) return template;

    const inheritsDefault = shadowed.is_default && shadowed.template_type === template.template_type;
    return {
      ...template,
      title: shadowed.title ?? template.title,
      is_default: inheritsDefault ? true : template.is_default,
    };
  });
  const survivingExtensionTemplates = extensionTemplates.filter((template) => !projectNames.has(template.name));

  return [...resolvedProjectTemplates, ...survivingExtensionTemplates].sort((a, b) => a.name.localeCompare(b.name));
};
