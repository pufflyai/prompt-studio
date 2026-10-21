import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";

const [library, migrate, role] = process.argv.slice(2);
const module = await import(pathToFileURL(resolve(library)).href);
const databaseUrl = process.env.DATABASE_URL!;
await module[migrate](databaseUrl, "./drizzle");

// Only the migration job receives the database owner credential. Runtime roles
// can use the resulting tables but cannot change the schema or another database.
if (role) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const name = client.escapeIdentifier(role);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${name}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${name}`);
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${name}`);
  } finally {
    await client.end();
  }
}
