const hasResource = (context: unknown) => {
  if (typeof context !== "string" || !context) return false;
  try {
    const parsed: unknown = JSON.parse(context);
    if (Array.isArray(parsed)) return typeof parsed[0] === "string" && parsed[0].length > 0;
  } catch {
    // Earlier canonical scopes stored a plain resource key rather than its context tuple.
  }
  return true;
};

/** Decode ownership once for retention, project transforms and page-content migration. */
export const layoutScopeIdentity = (scope: string | undefined) => {
  if (!scope) return;
  const legacy = scope.match(/^project\/([^/]+)/);
  if (legacy)
    return {
      projectId: legacy[1],
      pageId: undefined,
      resource: /^project\/[^/]+\/mode\/[^/]+\/resource\//.test(scope),
    };
  const prefix = ["workbench-main:", "workbench-collection-main:", "workbench-mode:"].find((value) =>
    scope.startsWith(value),
  );
  if (!prefix) return;
  try {
    const tuple: unknown = JSON.parse(scope.slice(prefix.length));
    const mode = prefix === "workbench-mode:";
    if (!Array.isArray(tuple) || tuple.length !== (mode ? 2 : 4)) return;
    return {
      projectId: typeof tuple[0] === "string" ? tuple[0] : undefined,
      pageId: !mode && typeof tuple[2] === "string" ? tuple[2] : undefined,
      resource: !mode && hasResource(tuple[3]),
    };
  } catch {
    return;
  }
};
