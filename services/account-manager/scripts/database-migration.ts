import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";

// Only the migration job receives the database owner credential. Runtime roles
// can use the resulting tables but cannot change the schema or another database.
export const grantServiceAccess = async (databaseUrl: string, role: string) => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const name = client.escapeIdentifier(role);
    const { rows } = await client.query<{ name: string }>("SELECT current_database() AS name");
    const database = client.escapeIdentifier(rows[0]!.name);
    // Services may share one server. Only this service's login may connect to its database.
    await client.query(`REVOKE ALL ON DATABASE ${database} FROM PUBLIC`);
    await client.query(`GRANT CONNECT ON DATABASE ${database} TO ${name}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${name}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${name}`);
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${name}`);
  } finally {
    await client.end();
  }
};

if (import.meta.main) {
  const [library, migrate, role] = process.argv.slice(2);
  const module = await import(pathToFileURL(resolve(library!)).href);
  const databaseUrl = process.env.DATABASE_URL!;
  await module[migrate!](databaseUrl, "./drizzle");
  if (role) await grantServiceAccess(databaseUrl, role);
}
