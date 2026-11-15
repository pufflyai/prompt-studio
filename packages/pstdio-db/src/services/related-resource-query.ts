import { sql } from "drizzle-orm";
import type { RelatedResourceQuery, ResourceRef } from "pstdio-api-contracts/extension-kernel";
import type { DbClient } from "../db/connection.pglite";

type Input = RelatedResourceQuery & { resources: (ResourceRef & { extensionId: string; projectId: string })[] };
export const queryRelatedResources = async (db: Pick<DbClient, "execute">, input: Input) => {
  const limit = input.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Limit must be between 1 and 100.");
  if (input.resources.length > 100) throw new Error("Query at most 100 resources.");
  if (!input.resources.length) return { items: [], nextCursor: null };
  const direction = input.direction ?? "outgoing";
  const scope = JSON.stringify([
    input.resources.map(({ projectId, extensionId, type, id }) => [projectId, extensionId, type, id]).sort(),
    direction,
    input.role,
    input.kind,
    input.owner,
    input.excludeKinds,
  ]);
  let after: string[] | undefined;
  if (input.cursor) {
    const cursor = JSON.parse(Buffer.from(input.cursor, "base64url").toString());
    if (
      cursor.scope !== scope ||
      !Array.isArray(cursor.key) ||
      cursor.key.length !== 4 ||
      cursor.key.some((key: unknown) => typeof key !== "string")
    )
      throw new Error("Invalid related resource cursor.");
    after = cursor.key;
  }
  const match = (side: "source" | "target") =>
    sql.join(
      input.resources.map(
        (ref) => sql`(
    project_id = ${ref.projectId} and ${sql.identifier(`${side}_owner`)} = ${ref.extensionId}
    and ${sql.identifier(`${side}_kind`)} = ${ref.type} and ${sql.identifier(`${side}_id`)} = ${ref.id}
  )`,
      ),
      sql` or `,
    );
  const role = input.role ? sql`and role = ${input.role}` : sql``;
  const queries = [];
  if (direction !== "incoming")
    queries.push(sql`select project_id, target_owner as owner, target_kind as kind, target_id as id,
    details - 'sourceRef' - 'role' as presentation, 0 as priority from resource_anchors where (${match("source")}) ${role}`);
  if (direction !== "outgoing")
    queries.push(sql`select project_id, source_owner as owner, source_kind as kind, source_id as id,
    coalesce(details->'sourceRef', '{}'::jsonb) as presentation, 1 as priority from resource_anchors where (${match("target")}) ${role}`);
  const result = await db.execute<{
    project_id: string;
    owner: string;
    kind: string;
    id: string;
    presentation: ResourceRef;
  }>(sql`
    with related as (${sql.join(queries, sql` union all `)}), distinct_resources as (
      select distinct on (project_id, owner, kind, id) * from related
      where true ${input.kind ? sql`and kind = ${input.kind}` : sql``} ${input.owner ? sql`and owner = ${input.owner}` : sql``}
      ${
        input.excludeKinds?.length
          ? sql`and kind not in (${sql.join(
              input.excludeKinds.map((kind) => sql`${kind}`),
              sql`, `,
            )})`
          : sql``
      }
      order by project_id, owner, kind, id, priority, presentation::text
    ) select * from distinct_resources where true
    ${
      after
        ? sql`and (project_id, owner, kind, id) > (${sql.join(
            after.map((value) => sql`${value}`),
            sql`, `,
          )})`
        : sql``
    }
    order by project_id, owner, kind, id limit ${limit + 1}
  `);
  const page = result.rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map(({ project_id, owner, kind, id, presentation }) => ({
      ...presentation,
      projectId: project_id,
      extensionId: owner,
      type: kind,
      id,
    })),
    nextCursor:
      result.rows.length > limit && last
        ? Buffer.from(JSON.stringify({ scope, key: [last.project_id, last.owner, last.kind, last.id] })).toString(
            "base64url",
          )
        : null,
  };
};
