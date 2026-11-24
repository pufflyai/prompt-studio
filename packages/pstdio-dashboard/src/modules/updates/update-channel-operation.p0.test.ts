import { expect, test } from "bun:test";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { getWorkbenchOperations } from "@pstdio/workbench";
import type { UpdateChannel } from "./update-channel-bridge";
import { changeUpdateChannel, projectUpdateChannel } from "./update-channel-operation";

test("two channel selections share a preview and the native result is read before the next write", async () => {
  const queries = createScopedQueryClient({ runtimeId: "desktop", extensionId: "pstdio" });
  const operations = getWorkbenchOperations(queries);
  const gate = Promise.withResolvers<void>();
  const writes: UpdateChannel[] = [];
  let confirmed: UpdateChannel = "stable";
  const bridge = {
    getAppInfo: async () => ({ version: "1" }),
    getUpdateChannel: async () => confirmed,
    setUpdateChannel: async (channel: UpdateChannel) => {
      writes.push(channel);
      if (channel === "nightly") await gate.promise;
      confirmed = channel;
    },
  };
  const change = (channel: UpdateChannel) =>
    changeUpdateChannel({
      bridge,
      operations,
      channel,
      sourceCommand: { id: "settings" },
      async accept(value) {
        if (value) confirmed = value;
      },
    });

  const first = change("nightly");
  expect(projectUpdateChannel(operations, confirmed)).toBe("nightly");
  const second = change("stable");
  expect(projectUpdateChannel(operations, confirmed)).toBe("stable");
  await Promise.resolve();
  expect(writes).toEqual(["nightly"]);
  gate.resolve();
  await first;
  await second;
  expect(writes).toEqual(["nightly", "stable"]);
  expect(confirmed).toBe("stable");
  queries.dispose();
});
