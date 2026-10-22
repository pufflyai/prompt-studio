import { and, eq } from "drizzle-orm";
import { reconcileResourceNumbers, resourceNumbers, resourceShorthand } from "pstdio-sync";
import type * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import {
  storage_resource_aliases as aliases,
  storage_resource_identities as identities,
  storage_resource_projections as projections,
} from "../../db/schemas.pg";
import type { DocumentAddress } from "./document-persistence";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

export const trackResourceIdentityProjection = async (
  tx: Transaction,
  address: DocumentAddress,
  document: Y.Doc,
  initialize: boolean,
) => {
  const workbench_id = address.workbench_id;
  const [projection] = await tx.select().from(projections).where(eq(projections.workbench_id, workbench_id));
  const resources = resourceNumbers(document);
  const history = document.getMap<true>("resource-number-history");
  const affected = new Set<string>();
  const changedAliases = new Set<string>();
  let rebuild = false;
  if (initialize && !projection) rebuild = true;
  const markAll = () => {
    for (const id of resources.keys()) affected.add(id);
    for (const key of history.keys()) changedAliases.add(key);
  };
  if (rebuild) markAll();
  const addChangedKeys = (target: Set<string>, keys: Set<string | null>) => {
    for (const key of keys) if (key !== null) target.add(key);
  };
  const changed = (transaction: Y.Transaction) => {
    for (const [type, keys] of transaction.changed) {
      if ((type as unknown) === resources) addChangedKeys(affected, keys);
      if ((type as unknown) === history) addChangedKeys(changedAliases, keys);
    }
  };
  document.on("afterTransaction", changed);
  return {
    rebuild: async () => {
      rebuild = true;
      markAll();
    },
    prepare: () => {
      if (affected.size || changedAliases.size) reconcileResourceNumbers(document);
    },
    stop: () => document.off("afterTransaction", changed),
    async persist(revision: number) {
      if (!projection && !rebuild) return;
      if (rebuild) {
        await tx.insert(projections).values({ workbench_id, revision }).onConflictDoNothing();
        await tx.delete(identities).where(eq(identities.workbench_id, workbench_id));
        await tx.delete(aliases).where(eq(aliases.workbench_id, workbench_id));
      }
      for (const id of affected) {
        const resource = resources.get(id);
        if (!resource) {
          await tx
            .delete(identities)
            .where(and(eq(identities.workbench_id, workbench_id), eq(identities.resource_id, id)));
          continue;
        }
        const row = {
          workbench_id,
          resource_id: id,
          extension_id: resource.extensionId,
          kind: resource.kind,
          shorthand: resourceShorthand(resource),
        };
        await tx
          .insert(identities)
          .values(row)
          .onConflictDoUpdate({ target: [identities.workbench_id, identities.resource_id], set: row });
      }
      const additions = [...changedAliases]
        .filter((key) => history.has(key))
        .map((key) => {
          const [resource_id, shorthand] = JSON.parse(key) as [string, string];
          return { workbench_id, resource_id, shorthand };
        });
      for (let offset = 0; offset < additions.length; offset += 2_000)
        await tx
          .insert(aliases)
          .values(additions.slice(offset, offset + 2_000))
          .onConflictDoNothing();
      for (const key of changedAliases)
        if (!history.has(key)) {
          const [id, shorthand] = JSON.parse(key) as [string, string];
          await tx
            .delete(aliases)
            .where(
              and(
                eq(aliases.workbench_id, workbench_id),
                eq(aliases.resource_id, id),
                eq(aliases.shorthand, shorthand),
              ),
            );
        }
      await tx.update(projections).set({ revision }).where(eq(projections.workbench_id, workbench_id));
      return affected.size;
    },
  };
};
