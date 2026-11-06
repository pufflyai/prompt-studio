import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { withCommandIntent } from "./command-intent";
import { acknowledgeNativeInputs, recoverNativeInputs } from "./native-recovery";
import {
  nativeSubmissionIndex,
  readNativeSubmissions,
  saveNativeSubmission,
  updateNativeSubmission,
} from "./native-submission";

const fixture = () =>
  makeCommandContext({ storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }), params: {} });
const draft = {
  text: "Keep native objective",
  attachments: [],
  values: withCommandIntent(
    { harness: { harnessId: "agent", model: "B" } },
    { harnessId: "agent", command: { name: "/goal", description: "Goal", composer: { label: "Goal" } } },
  ),
};
const operation = { kind: "command" as const, text: "/goal Keep native objective" };

test("failed accepted native input recovers its full draft once after a new run, even when its submitted tag was hidden", async () => {
  const ctx = fixture();
  const recordId = await saveNativeSubmission(ctx, "s", { draft, operation }, "previous", true);
  await updateNativeSubmission(ctx, recordId, { hidden: true });
  const recovered: unknown[] = [];
  const emitted = new Set<string>();
  const emit = async (value: unknown) => {
    recovered.push(value);
  };
  await recoverNativeInputs(ctx, "s", { status: "failed", lastRequestStarted: "previous" }, emit, emitted);
  expect(recovered).toEqual([]);
  await recoverNativeInputs(ctx, "s", { status: "failed", lastRequestStarted: "new-run" }, emit, emitted);
  await recoverNativeInputs(ctx, "s", { status: "failed", lastRequestStarted: "new-run" }, emit, emitted);
  expect(recovered).toEqual([draft]);
  expect(await readNativeSubmissions(ctx, "s", true)).toHaveLength(1);
  await acknowledgeNativeInputs(ctx, "s", { text: "Newer body", attachments: [], values: {}, recovered: [draft] });
  expect(await readNativeSubmissions(ctx, "s", true)).toEqual([]);
});

test("a failed presentation handoff leaves native input available for a reconnect", async () => {
  const ctx = fixture();
  await saveNativeSubmission(ctx, "s", { draft, operation }, "previous", true);
  const ended = { status: "disconnected", lastRequestStarted: "new-run" };
  await expect(
    recoverNativeInputs(ctx, "s", ended, async () => {
      throw new Error("Presentation closed");
    }),
  ).rejects.toThrow("Presentation closed");
  expect(await readNativeSubmissions(ctx, "s", true)).toHaveLength(1);
  const recovered: unknown[] = [];
  await recoverNativeInputs(ctx, "s", ended, async (value) => {
    recovered.push(value);
  });
  expect(recovered).toEqual([draft]);
});

test("deleting a confirmed native input between index query and read leaves pending recovery usable", async () => {
  const ctx = fixture();
  const recordId = await saveNativeSubmission(ctx, "s", { draft, operation }, null, false);
  expect((await readNativeSubmissions(ctx, "s"))[0]?.body.draft).toEqual(draft);
  const readMany = ctx.storage.records.readMany.bind(ctx.storage.records);
  let race = true;
  ctx.storage.records.readMany = async (...args) => {
    if (race) {
      race = false;
      await updateNativeSubmission(ctx, recordId, { hidden: true }, "s");
    }
    return readMany(...args);
  };
  expect(await readNativeSubmissions(ctx, "s")).toEqual([]);
  expect(await readNativeSubmissions(ctx, "s")).toEqual([]);
  const pending = await saveNativeSubmission(ctx, "other", { draft, operation }, null, true);
  await updateNativeSubmission(ctx, pending, { hidden: true }, "other");
  expect((await readNativeSubmissions(ctx, "other", true))[0]?.body.draft).toEqual(draft);
});

test("a corrupt live native input remains a visible error instead of disappearing", async () => {
  const ctx = fixture();
  const recordId = await saveNativeSubmission(ctx, "s", { draft, operation }, null, false);
  await ctx.storage.records.commit({
    operationId: ctx.storage.ids.create(),
    edits: [{ recordId, replace: { sessionId: "s", state: "confirmed", createdAt: new Date().toISOString() } }],
  });
  await expect(readNativeSubmissions(ctx, "s")).rejects.toThrow();
  expect((await ctx.storage.records.read(recordId)).exists).toBe(true);
});
