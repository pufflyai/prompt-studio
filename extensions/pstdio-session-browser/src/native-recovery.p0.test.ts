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
