import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "./schema";

export const connectRelay = (databaseUrl: string) => {
  if (!databaseUrl) throw new Error("Relay storage requires a PostgreSQL URL");
  const client = new Pool({ connectionString: databaseUrl });
  return { db: drizzle(client, { schema }), close: () => client.end() };
};

export type RelayDatabase = ReturnType<typeof connectRelay>["db"];
export type RelayTransaction = Parameters<Parameters<RelayDatabase["transaction"]>[0]>[0];

export const migrateRelayStorage = async (databaseUrl: string, migrationsFolder: string) => {
  const connection = connectRelay(databaseUrl);
  try {
    await migrate(connection.db, { migrationsFolder });
  } finally {
    await connection.close();
  }
};
