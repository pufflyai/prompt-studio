import { expect, test } from "bun:test";
import { createWebviewClient, type GuestHost } from "@pstdio/sdk/extensions";
import type { commands } from "./commands";
import { createHomeQueries } from "./home-queries";

test("a recreated Home frame restores its accepted project before admitting another read", () => {
  const home = { project: { name: "Accepted Home" }, setupError: null };
  const host = {
    extensionId: "pstdio.pstdio-home",
    propsStore: {
      get: () => ({
        projectId: "selected",
        commandQueries: {
          owner: "selected-home",
          values: [
            {
              command: { commandId: "pstdio.pstdio-home.command.read" },
              snapshot: { generation: 1, version: 2, data: home, stale: false, fetching: false },
            },
          ],
        },
      }),
      subscribe: () => () => {},
    },
    onEvent: () => () => {},
    call: async () => {
      throw new Error("Restoration cannot execute another command");
    },
  } as unknown as GuestHost;
  const client = createWebviewClient<typeof commands>(host);
  const queries = createHomeQueries(client);
  try {
    expect(queries.home.getSnapshot().data).toEqual(home);
  } finally {
    client.queries.dispose();
  }
});
