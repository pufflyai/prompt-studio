import { expect, test } from "bun:test";
import { createWebviewClient, type GuestHost, workbenchCommands } from "@pstdio/sdk/extensions";
import type { commands } from "./commands";
import { homeQueries } from "./home-queries";

test("returning to Home restores project reads without a command on its retired viewer", () => {
  const home = { project: { id: "project", name: "Retained project", shorthand: "P" }, setupError: null };
  const snapshot = (data: unknown) => ({ generation: 1, version: 1, data, stale: false, fetching: false });
  const host = {
    extensionId: "pstdio.pstdio-home",
    propsStore: {
      get: () => ({
        projectId: "project",
        commandQueries: {
          owner: "home-owner",
          values: [
            { command: { commandId: "pstdio.pstdio-home.command.read" }, snapshot: snapshot(home) },
            { command: { commandId: workbenchCommands.recentResources.id, params: {} }, snapshot: snapshot([]) },
          ],
        },
      }),
      subscribe: () => () => {},
    },
    onEvent: () => () => {},
    call: async () => {
      throw new Error("The calling viewer is no longer open");
    },
  } as unknown as GuestHost;
  const client = createWebviewClient<typeof commands>(host);
  const queries = homeQueries(client);
  expect(queries.home.getSnapshot().data).toEqual(home);
  expect(queries.recent.getSnapshot().data).toEqual([]);
  client.queries.dispose();
});
