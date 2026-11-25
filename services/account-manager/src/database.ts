import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

// The manager shares the database server with the relay; a small pool queues bursts instead of
// exhausting the server's connection slots.
export const connectManager = (databaseUrl: string, poolMax = 4) => {
  if (!databaseUrl) throw new Error("Account authority requires a private PostgreSQL URL");
  const pool = new Pool({ connectionString: databaseUrl, max: poolMax });
  let closing: Promise<void> | undefined;
  return { db: drizzle(pool), close: () => (closing ??= pool.end()) };
};
export type ManagerDatabase = ReturnType<typeof connectManager>["db"];
export type ManagerTransaction = Parameters<Parameters<ManagerDatabase["transaction"]>[0]>[0];

export const migrateAccountManager = async (databaseUrl: string, migrationsFolder: string) => {
  const connection = connectManager(databaseUrl);
  try {
    await migrate(connection.db, { migrationsFolder });
  } finally {
    await connection.close();
  }
};
