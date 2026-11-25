import { expect, test } from "bun:test";
import { createCheckpointWriter } from "./checkpoint-writer";

test("delivered checkpoints retain the skip count after the write queue catches up", async () => {
  const first = Promise.withResolvers<void>();
  const delivered: number[] = [];
  const writer = createCheckpointWriter<{ skippedCheckpoints: number }>(
    async (checkpoint) => {
      delivered.push(checkpoint.skippedCheckpoints);
      if (delivered.length === 1) await first.promise;
    },
    (error) => {
      throw error;
    },
  );
  const queue = () => writer.queue({ skippedCheckpoints: 0 });
  queue();
  queue();
  queue();
  first.resolve();
  await writer.flush(new AbortController().signal);
  queue();
  await writer.flush(new AbortController().signal);
  expect(delivered).toEqual([0, 1, 1]);
});
