import type { ReferenceResourceType } from "../../../prompt-input";
import type { ReferenceMenuOption } from "../ReferenceMenuOption";

const localFilter = (data: ReferenceMenuOption[], q: string) =>
  data.filter((m) => m.name.replace(/ /g, "_").toLowerCase().includes(q.toLowerCase()));

/**
 * Search across all resources and menu options
 *
 * @param queryString
 * @returns
 */
export function useContextLookup(
  queryString: string | null,
  items: {
    resourceId: string;
    resourceType: ReferenceResourceType;
    name: string;
    description?: string;
  }[] = [],
) {
  const baseOptions: ReferenceMenuOption[] = items.map(
    (res, index): ReferenceMenuOption => ({
      id: res.resourceId,
      key: res.resourceId,
      index,
      group: res.resourceType,
      name: res.name,
      description: res.description,
      setRefElement: () => {},
    }),
  );

  if (queryString == null || queryString === "") {
    return baseOptions;
  }

  return localFilter(baseOptions, queryString);
}
