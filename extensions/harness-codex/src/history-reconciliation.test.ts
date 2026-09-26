import { expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/sdk/extensions";
import { recoverCodexMessages } from "./history-reconciliation";
import { createCodexStreamPipeline } from "./normalize-stream";
import { normalizeRollout } from "./rollout";

test("paired live and rollout history preserve reasoning and usage with one native execution", async () => {
  const nativeMessages = normalizeRollout(await Bun.file(new URL("./mocks/rollout.jsonl", import.meta.url)).text());
  const knownMessages: SessionMessage[] = [nativeMessages[0]];
  const pipeline = createCodexStreamPipeline(
    {
      getMessages: () => knownMessages,
      push: (patch) => {
        const index = Number(patch.path.split("/").at(-1));
        if (patch.op === "add") knownMessages.splice(index, 0, patch.value as SessionMessage);
        else knownMessages[index] = patch.value as SessionMessage;
      },
    },
    { indexOffset: 1 },
  );
  const live = await Bun.file(new URL("./mocks/tool-events.jsonl", import.meta.url)).text();
  live.split("\n").forEach(pipeline.handleLine);
  const result = recoverCodexMessages({ knownMessages, nativeMessages, cwd: "/tmp/codex-harness-e2e" });
  expect(result.kind).toBe("recovered");
  if (result.kind !== "recovered") return;
  expect(result.messages).toEqual([...nativeMessages, knownMessages.at(-1)!]);
});
