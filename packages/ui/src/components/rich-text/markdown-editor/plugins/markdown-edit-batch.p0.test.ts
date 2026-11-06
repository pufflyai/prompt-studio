import { expect, test } from "bun:test";
import { createMarkdownEditBatch } from "./markdown-edit-batch";

test("continuous input publishes periodically instead of starving until typing stops", async () => {
  let published = 0;
  const batch = createMarkdownEditBatch(() => published++);
  try {
    for (let index = 0; index < 12; index++) {
      batch.schedule();
      await Bun.sleep(90);
    }
    expect(published).toBeGreaterThan(0);
  } finally {
    batch.cancel();
  }
});
