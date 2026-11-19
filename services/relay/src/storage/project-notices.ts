import { Client } from "pg";

export const projectRetiredChannel = "relay_project_retired";

// A replica that loses notifications closes its sockets before admitting another live connection.
export const createProjectNotices = (databaseUrl: string, retired: (key: string) => void, disconnected: () => void) => {
  let listener: { client: Client; ready: Promise<void> } | undefined;
  const closing = new Set<Promise<void>>();
  const end = (client: Client) => {
    const closed = client.end().catch(() => {});
    closing.add(closed);
    void closed.finally(() => closing.delete(closed));
  };
  const open = () => {
    const client = new Client({ connectionString: databaseUrl, application_name: "pstdio-relay-projects" });
    const failed = () => {
      if (listener?.client !== client) return;
      listener = undefined;
      disconnected();
      end(client);
    };
    client.on("error", failed);
    client.on("end", failed);
    client.on("notification", ({ channel, payload }) => {
      if (listener?.client === client && channel === projectRetiredChannel && payload) retired(payload);
    });
    const ready = client
      .connect()
      .then(async () => {
        await client.query(`LISTEN ${projectRetiredChannel}`);
      })
      .catch((error) => {
        failed();
        throw error;
      });
    return { client, ready };
  };
  let stopped = false;
  return {
    async ready() {
      if (stopped) throw new Error("Project notification listener is closed");
      listener ??= open();
      const current = listener;
      await current.ready;
      if (listener !== current) throw new Error("Project notification listener disconnected");
    },
    async close() {
      stopped = true;
      const current = listener;
      listener = undefined;
      disconnected();
      if (current) end(current.client);
      await Promise.all(closing);
    },
  };
};
