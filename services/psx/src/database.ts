import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "./schema";

export const connectPsx = (databaseUrl: string) => {
  if (!databaseUrl) throw new Error("PSX requires a PostgreSQL URL");
  const pool = new Pool({ connectionString: databaseUrl });
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
};
export type PsxDatabase = ReturnType<typeof connectPsx>["db"];
export const migratePsx = async (databaseUrl: string, migrationsFolder: string) => {
  const connection = connectPsx(databaseUrl);
  try {
    await migrate(connection.db, { migrationsFolder });
  } finally {
    await connection.close();
  }
};
