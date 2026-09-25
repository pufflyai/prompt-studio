import { type SQLWrapper, sql } from "drizzle-orm";
import type { ResourceRef } from "../db/schemas.pg";

// Evaluate against the locked row inside UPDATE so concurrent links cannot overwrite each other.
export const mergeResourceAnchors = (column: SQLWrapper, anchors: ResourceRef[]) => sql`(
  select coalesce(jsonb_agg(anchor order by first_position), '[]'::jsonb)
  from (
    select distinct on (anchor->>'type', anchor->>'id') anchor,
      min(position) over (partition by anchor->>'type', anchor->>'id') as first_position
    from jsonb_array_elements(${column} || ${JSON.stringify(anchors)}::jsonb)
      with ordinality as entries(anchor, position)
    order by anchor->>'type', anchor->>'id', position desc
  ) merged
)`;

export const removeResourceAnchors = (column: SQLWrapper, refs: Pick<ResourceRef, "type" | "id">[]) => sql`(
  select coalesce(jsonb_agg(anchor order by position), '[]'::jsonb)
  from jsonb_array_elements(${column}) with ordinality as entries(anchor, position)
  where not exists (
    select 1 from jsonb_array_elements(${JSON.stringify(refs)}::jsonb) as refs(ref)
    where ref->>'type' = anchor->>'type' and ref->>'id' = anchor->>'id'
  )
)`;
