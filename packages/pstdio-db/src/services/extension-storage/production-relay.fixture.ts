import { resolve } from "node:path";
import { SQL } from "bun";
import { createRelayStorage, migrateRelayStorage } from "pstdio-relay";
import type { Asset, Mutation, Scope, Snapshot } from "pstdio-sync-contracts";
import { createConformanceObjects } from "pstdio-sync-contracts/conformance";

export const createProductionRelayServices = async (databaseUrl: string, objectEndpoint: string) => {
  if (!databaseUrl || !objectEndpoint) throw new Error("Production conformance requires isolated service endpoints");
  const objects = createConformanceObjects(objectEndpoint);
  await objects.initialize();
  await migrateRelayStorage(databaseUrl, resolve(import.meta.dir, "../../../../../infra/relay/drizzle"));
  const storage = createRelayStorage(databaseUrl, {
    complete: async (scope: Scope, asset: Asset) => (await objects.get(scope, asset)) !== null,
  });
  const faults = new SQL(databaseUrl);
  await faults`CREATE TABLE relay_test_commit_failures (operation_id text PRIMARY KEY)`;
  await faults`CREATE FUNCTION relay_test_fail_commit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM relay_test_commit_failures WHERE operation_id = NEW.id) THEN
        RAISE EXCEPTION 'crash before commit';
      END IF;
      RETURN NEW;
    END
  $$`;
  await faults`CREATE TRIGGER relay_test_before_commit BEFORE INSERT OR UPDATE ON relay_operations
    FOR EACH ROW EXECUTE FUNCTION relay_test_fail_commit()`;

  const owner = (scope: Scope) => storage.initialize(scope, "published-1");
  const relay = {
    snapshot: async (scope: Scope) => (await owner(scope)).snapshot(),
    async submit(mutation: Mutation, crash?: "before-commit" | "after-commit") {
      const target = await owner(mutation.scope);
      if (crash === "before-commit") {
        await faults`INSERT INTO relay_test_commit_failures VALUES (${mutation.operationId})`;
        try {
          await target.submit(mutation);
          throw new Error("Test failure trigger did not abort publication");
        } catch (cause) {
          throw new Error("crash before commit", { cause });
        } finally {
          await faults`DELETE FROM relay_test_commit_failures WHERE operation_id = ${mutation.operationId}`;
        }
      }
      const receipt = await target.submit(mutation);
      if (crash === "after-commit") throw new Error("crash after commit before acknowledgment");
      return receipt;
    },
    restore: async (snapshot: Snapshot) => (await owner(snapshot.scope)).restore(snapshot),
    async publish(scope: Scope, revision: string) {
      const target = await owner(scope);
      const current = await target.snapshot();
      await target.publishRevision(current.publishedRevision, revision);
    },
    close: storage.close,
  };
  return {
    relay,
    objects,
    async close() {
      await faults.close();
      await relay.close();
      objects.close();
    },
  };
};
