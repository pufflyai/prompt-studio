import type { WhenExpression } from "pstdio-api-contracts/extension-kernel";

/**
 * Resource-scoped visibility for command-palette contributions. Both the workbench host and the
 * dashboard palette gate the same way, so the rule lives here once instead of being re-derived per
 * surface. Only `resourceType` is evaluated: it is the sole `when` field a palette surface can
 * resolve from the active resource alone (`mode`/`source`/`metadata` require execution context the
 * palette does not have).
 */
export const matchesResourceWhen = (
  when: Pick<WhenExpression, "resourceType"> | { resourceType?: readonly string[] } | undefined,
  resourceType: string | undefined,
) => {
  const resourceTypes = when?.resourceType;
  if (!resourceTypes?.length) return true;
  return resourceType
    ? resourceTypes.some((candidate) => (typeof candidate === "string" ? candidate : candidate.id) === resourceType)
    : false;
};
