import { Client } from "pg";

export const withFixtureDatabase = async <T>(url: string, action: (client: Client) => Promise<T>) => {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await action(client);
  } finally {
    await client.end();
  }
};
export const blockFixtureTable = async (url: string, table: "manager_accounts" | "relay_scopes") => {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`LOCK ${table} IN ACCESS EXCLUSIVE MODE`);
  } catch (error) {
    await client.end();
    throw error;
  }
  return async () => {
    await client.query("ROLLBACK");
    await client.end();
  };
};
export const waitForFixtureLock = (url: string) =>
  withFixtureDatabase(url, async (client) => {
    while (true) {
      const result = await client.query(
        "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'",
      );
      if (result.rows[0].count > 0) return;
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  });
