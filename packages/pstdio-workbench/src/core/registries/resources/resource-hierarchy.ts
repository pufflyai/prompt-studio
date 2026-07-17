import type { ResourceRef } from "./resource-registry";

export const maxResourceAncestryDepth = 16;

// Parent edges come from providers, so malformed data must shorten navigation rather than
// crash it. The seen set terminates cycles while the cap bounds valid but unreasonable chains.
export const collectResourceAncestors = (
  getResource: (uri: string) => ResourceRef | undefined,
  resource: ResourceRef,
) => {
  const ancestors: ResourceRef[] = [];
  const seen = new Set([resource.uri]);
  let current = resource;

  while (ancestors.length < maxResourceAncestryDepth) {
    const parentUri = current.parent;
    if (!parentUri || seen.has(parentUri)) break;

    const parent = getResource(parentUri);
    if (!parent) break;

    seen.add(parentUri);
    ancestors.push(parent);
    current = parent;
  }

  return ancestors;
};
