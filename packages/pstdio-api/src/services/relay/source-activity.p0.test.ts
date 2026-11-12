import { expect, test } from "bun:test";
import { createSourceActivity } from "./source-activity";

test("source activity keeps the phase of outstanding work when concurrent jobs finish out of order", async () => {
  const activity = createSourceActivity();
  const apply = Promise.withResolvers<void>(),
    merge = Promise.withResolvers<void>();
  const first = activity.run("record-stream:apply", () => apply.promise);
  const second = activity.run("record-stream:merge", () => merge.promise);
  try {
    apply.resolve();
    await first;
    expect(activity.status().phase).toBe("record-stream:merge");
    merge.resolve();
    await second;
    expect(activity.status().phase).toBe("ready");
  } finally {
    apply.resolve();
    merge.resolve();
    await Promise.allSettled([first, second]);
    activity.close();
  }
});
