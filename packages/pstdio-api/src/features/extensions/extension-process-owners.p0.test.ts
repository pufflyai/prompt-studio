import { expect, test } from "bun:test";
import { createExtensionProcessOwners } from "./extension-process-owners";
import type { ProcessEnvironmentSource } from "./process-environment/permissions";

const source: ProcessEnvironmentSource = {
  extension_id: "acme.agent",
  source_path: "/extensions/agent",
  source_hash: "hash-1",
  manifest_json: {},
};

const child = () => {
  const exited = Promise.withResolvers<{ code: number | null; signal: string | null }>();
  const state = { killed: false };
  return {
    state,
    handle: {
      exited: exited.promise,
      kill: async () => {
        state.killed = true;
        exited.resolve({ code: null, signal: "SIGTERM" });
      },
    },
  };
};

test("a call that outlived its source's retirement cannot revive that generation", async () => {
  // The source was disabled while the call ran; no later invalidation arrives.
  const owners = createExtensionProcessOwners({ findEnabledSource: async () => undefined });
  const late = child();
  owners.owner("project-1", source).adopt(late.handle);
  await Bun.sleep(10);
  expect(late.state.killed).toBe(true);
});

test("a generation of the enabled source keeps its children", async () => {
  const owners = createExtensionProcessOwners({ findEnabledSource: async () => source });
  const kept = child();
  owners.owner("project-1", source).adopt(kept.handle);
  await Bun.sleep(10);
  expect(kept.state.killed).toBe(false);
  await owners.dispose();
  expect(kept.state.killed).toBe(true);
});
