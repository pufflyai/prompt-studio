import type { RouteDeps } from "../../features/deps";

/** Only the latest identity read may publish a login. Cached reads invalidate with the native account owner. */
export const createPersonalIdentity = (input: {
  account: Pick<RouteDeps["accountService"], "status"> & Partial<Pick<RouteDeps["accountService"], "watch">>;
  eventBus: RouteDeps["eventBus"];
  changed: () => void;
}) => {
  type Login = Awaited<ReturnType<typeof input.account.status>>["login"];
  let version: string | undefined;
  let revision = {};
  let generation = 0;
  let latest: Promise<Login> | undefined;
  let cached: Promise<Login> | undefined;
  const visible = new Map<string, { table: string; id: string; projectId: string }>();
  const accept = (login: Login) => {
    const next = JSON.stringify(login && [login.managerOrigin, login.accountId, login.deviceId]);
    if (version === next) return;
    for (const { table, id, projectId } of visible.values()) {
      input.eventBus.emit(table, "delete", { id });
      if (table === "workspace_sessions") continue;
      input.eventBus.emit("resource_events", "set", {
        id: crypto.randomUUID(),
        resource: { type: table === "sessions" ? "session" : "workspace", id, projectId, extensionId: "pstdio" },
      });
    }
    visible.clear();
    version = next;
    revision = {};
    input.changed();
  };
  const refresh = () => {
    const started = ++generation;
    latest = input.account
      .status()
      .then(({ login }) => {
        if (started !== generation) return latest!;
        accept(login);
        return login;
      })
      .catch((error) => {
        if (started === generation) cached = undefined;
        throw error;
      });
    cached = latest;
    return latest;
  };
  const read = () => {
    if (!input.account.watch) return refresh();
    if (!cached) return refresh();
    return cached;
  };
  input.account.watch?.(() => {
    cached = undefined;
    void read().catch(() => {});
  });
  return {
    read,
    refresh,
    get version() {
      return version;
    },
    get revision() {
      return revision;
    },
    remember: (table: string, id: string, projectId: string) =>
      visible.set(JSON.stringify([table, id]), { table, id, projectId }),
  };
};
