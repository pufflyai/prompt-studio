import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { createDatabaseLeases } from "../database-leases";
import * as schema from "./schema";

export const connectRelay = (databaseUrl: string) => {
  if (!databaseUrl) throw new Error("Relay storage requires a PostgreSQL URL");
  const client = new Pool({ connectionString: databaseUrl });
  const leases = createDatabaseLeases(databaseUrl, [client]);
  return {
    db: drizzle(client, { schema }),
    run: <T>(action: (database: RelayDatabase) => Promise<T>, signal?: AbortSignal) =>
      leases.run(client, (connection) => action(drizzle(connection, { schema })), signal),
    close: leases.close,
  };
};

export type RelayDatabase = NodePgDatabase<typeof schema>;
export type RelayTransaction = Parameters<Parameters<RelayDatabase["transaction"]>[0]>[0];

export const migrateRelayStorage = async (databaseUrl: string, migrationsFolder: string) => {
  const connection = connectRelay(databaseUrl);
  try {
    await migrate(connection.db, { migrationsFolder });
  } finally {
    await connection.close();
  }
};
