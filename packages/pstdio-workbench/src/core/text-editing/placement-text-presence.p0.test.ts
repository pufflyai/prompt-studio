import { expect, test } from "bun:test";
import { createWorkbench } from "../workbench-core";
import { createPlacementTextPresence } from "./placement-text-presence";

test("three document cursors from one connected device appear once in chrome", async () => {
  const workbench = createWorkbench();
  const sources = [];
  for (let index = 0; index < 3; index++) {
    const source = createPlacementTextPresence(workbench);
    sources.push(source);
    const memberId = `member-${index}`;
    const handle = `handle-${index}`;
    await source.request({ operation: "register", memberId }, async () => {});
    await source.request({ operation: "open", memberId, input: { grant: { token: "source" } } }, async () => ({
      handle,
    }));
    source.receive({
      type: "presence",
      memberId,
      handle,
      version: 1,
      participants: [
        { id: `cursor-${index}`, deviceId: "device", label: "Alex", deviceName: "Laptop", selection: null },
      ],
    });
  }
  expect(workbench.presence.store.getState().participants).toEqual([{ id: "device", label: "Alex" }]);
  sources[0]!.dispose();
  expect(workbench.presence.store.getState().participants).toHaveLength(1);
  for (const source of sources.slice(1)) source.dispose();
  expect(workbench.presence.store.getState().participants).toEqual([]);
});
