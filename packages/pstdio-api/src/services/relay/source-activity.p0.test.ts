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

test("untracked relay responses update progress without leaving an idle source busy", () => {
  const activity = createSourceActivity();
  try {
    activity.complete();
    activity.network({ phase: "waiting-for-response" });
    activity.network({ phase: "receiving-response", bytes: 12 });
    expect(activity.status()).toMatchObject({ phase: "ready", lastProgressAt: expect.any(String) });
  } finally {
    activity.close();
  }
});

test("a failed concurrent operation retains its own phase after the remaining operation completes", async () => {
  const activity = createSourceActivity();
  const apply = Promise.withResolvers<void>();
  const merge = Promise.withResolvers<void>();
  const failure = new Error("Apply failed");
  const first = activity.run("record-stream:apply", () => apply.promise).catch((error) => error);
  const second = activity.run("record-stream:merge", () => merge.promise);
  try {
    apply.reject(failure);
    expect(await first).toBe(failure);
    expect(activity.status().phase).toBe("record-stream:merge");
    merge.resolve();
    await second;
    expect(activity.status().phase).toBe("record-stream:apply");
  } finally {
    apply.resolve();
    merge.resolve();
    await Promise.allSettled([first, second]);
    activity.close();
  }
});

test("pending files remain visible while another source operation is running and clear when it drains", async () => {
  const activity = createSourceActivity();
  const remaining = Promise.withResolvers<void>();
  const running = activity.run("receiving-records", () => remaining.promise);
  try {
    activity.file({
      id: "pending",
      direction: "download",
      status: "queued",
      byteLength: 10,
      completedBytes: 0,
      totalBytes: 38,
    });
    await activity.run("internal-document", async () => {});
    expect(activity.status().files).toHaveLength(1);
    remaining.resolve();
    await running;
    expect(activity.status().files).toEqual([]);
  } finally {
    remaining.resolve();
    await running;
    activity.close();
  }
});
