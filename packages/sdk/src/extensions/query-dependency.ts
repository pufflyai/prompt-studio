import type { QueryChangeEnvelope, QueryDependency } from "pstdio-api-contracts/extension-kernel";

export type { QueryChangeEnvelope, QueryDependency } from "pstdio-api-contracts/extension-kernel";

const matchesRecords = (event: QueryChangeEnvelope, dependency: QueryDependency) => {
  if (!event.recordIds) return true;
  const ids = [...(dependency.recordIds ?? []), ...(dependency.recordId ? [dependency.recordId] : [])];
  return ids.length === 0 || ids.some((id) => event.recordIds!.includes(id));
};

/** Unknown legacy scope is a conservative refresh, never a silently missed update. */
export const matchesQueryDependency = (
  event: (QueryChangeEnvelope & { type?: string }) | undefined,
  dependency: QueryDependency,
) => {
  if (!event) return true;
  if (event.projectId && dependency.projectId && event.projectId !== dependency.projectId) return false;
  if (event.extensionId && dependency.extensionId && event.extensionId !== dependency.extensionId) return false;
  if (!matchesRecords(event, dependency)) return false;
  const keys = event.resourceKeys ?? (event.resourceKey ? [event.resourceKey] : undefined);
  if (keys && dependency.resourceKey && !keys.includes(dependency.resourceKey)) return false;
  if (event.resourceIds && dependency.resourceId && !event.resourceIds.includes(dependency.resourceId)) return false;
  const changes =
    dependency.resourceId && event.changes
      ? event.changes.filter((change) => change.resourceId === dependency.resourceId)
      : event.changes;
  if (changes && dependency.fields)
    return changes.some(
      (change) => change.membership || dependency.fields!.some((field) => change.changedFields.includes(field)),
    );
  if (
    event.changedFields &&
    dependency.fields &&
    !event.membership &&
    !dependency.fields.some((field) => event.changedFields!.includes(field))
  )
    return false;
  return true;
};
