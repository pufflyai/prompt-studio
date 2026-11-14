import type { ResourceActivityEntry, ResourceRef } from "@pstdio/sdk/extensions";
import type { ResourceActivityBinding } from "../../core/registries/resources/resource-activity";
/** Reconcile the already visible bounded window so live updates do not discard older pages. */
export const readActivityWindow = async (
  binding: ResourceActivityBinding,
  resource: ResourceRef,
  input: { cursor?: string; count: number },
) => {
  let next = input.cursor;
  const page = { items: [] as ResourceActivityEntry[], nextCursor: null as string | null, unresolved: 0 };
  do {
    const batch = await binding.api.query({ resource, cursor: next, limit: 50 });
    page.items.push(...batch.items);
    page.nextCursor = batch.nextCursor;
    page.unresolved = batch.unresolved;
    next = batch.nextCursor ?? undefined;
  } while (next && page.items.length < input.count);
  const roots = await Promise.all(
    [...new Set(page.items.flatMap((entry) => (entry.replyToId ? [entry.replyToId] : [])))].map((id) =>
      binding.api.get(resource, id),
    ),
  );
  return { ...page, items: [...page.items, ...roots] };
};
