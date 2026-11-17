import type { PstdioClient } from "@pstdio/sdk/client";
import { type AccountStatus, accountEvents, type ScopedQuery, type ScopedQueryClient } from "@pstdio/sdk/extensions";
import type { WebviewAccountQuery, WebviewAccountQueryValue } from "pstdio-api-contracts/extension-kernel";

const requireAccountIdentity = async (
  account: ScopedQuery<AccountStatus>,
  definition: Extract<WebviewAccountQuery, { service: "devices" }>,
  signal: AbortSignal,
) => {
  for (;;) {
    const status = await account.read(signal);
    signal.throwIfAborted();
    const current = account.getSnapshot();
    if (current.error) throw current.error;
    if (current.fetching || account.inspect().stale || current.data !== status) continue;
    if (
      status.signInRequired ||
      status.login?.accountId !== definition.accountId ||
      status.login.managerOrigin !== definition.managerOrigin
    )
      throw new Error("The account changed before the device read completed");
    return;
  }
};

/** Canonical account/origin service sources, shared by every authorized view of this runtime. */
export const createAccountQuerySources = (input: {
  queries: ScopedQueryClient;
  account: ScopedQuery<AccountStatus>;
  client: Pick<PstdioClient, "account">;
}) => {
  const entries = new Map<ScopedQuery<unknown>, { source: WebviewAccountQuery; query: ScopedQuery<unknown> }>();
  const { queries, account, client } = input;
  const stop = queries.subscribeRetirement(() => {
    for (const [query] of entries) if (query.isDisposed()) entries.delete(query);
  });
  const createSource = (definition: Exclude<WebviewAccountQuery, { service: "status" }>) => {
    const login = account.getSnapshot().data?.login;
    const expected = login ? { accountId: login.accountId, managerOrigin: login.managerOrigin } : null;
    const projectId = definition.service === "projectSyncStatus" ? definition.projectId : undefined;
    const query = queries.forScope({ projectId, extensionId: "pstdio.account" }).query({
      id: "account." + definition.service,
      params: definition,
      dependsOn: [accountEvents.changed.id, ...(projectId ? [accountEvents.projectSyncChanged.id] : [])],
      // Remote device presence has no complete push stream. Its observation window
      // must catch up after detachment, without polling or retaining an optional read.
      subscribe: definition.service === "devices" ? () => () => {} : undefined,
      async read(signal) {
        if (definition.service === "projectSyncStatus")
          return client.account.projectSyncStatus(definition.projectId, { signal, expected });
        const requireLogin = () => requireAccountIdentity(account, definition, signal);
        await requireLogin();
        const devices = await client.account.devices({
          signal,
          expected: { accountId: definition.accountId, managerOrigin: definition.managerOrigin },
        });
        await requireLogin();
        return devices;
      },
    });
    entries.set(query, { source: definition, query });
    return query;
  };
  const source = <Definition extends WebviewAccountQuery>(definition: Definition) => {
    const query = definition.service === "status" ? account : createSource(definition);
    // The discriminant selects one canonical source; expose its corresponding public result.
    return query as ScopedQuery<WebviewAccountQueryValue<Definition>>;
  };
  return {
    source,
    dispose: stop,
    sources: (projectId: string | undefined) => [
      { source: { service: "status" } as const, query: account },
      ...[...entries.values()].filter(
        ({ source, query }) =>
          !query.isDisposed() && (source.service !== "projectSyncStatus" || source.projectId === projectId),
      ),
    ],
  };
};
