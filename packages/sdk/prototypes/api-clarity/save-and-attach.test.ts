import { expect, test } from "bun:test";
import { createFixture } from "./fixture";
import * as proposal from "./proposal.tasks";
import * as revised from "./revised.tasks";

test("save preserves the captured revision and rejects a competing edit without losing the draft", async () => {
  const { apis, inputs, storage } = await createFixture();
  await storage.records.commit({
    operationId: "other-editor",
    edits: [
      { recordId: inputs.ticket.recordId, expectedRevision: inputs.ticket.revision, replace: { title: "Other edit" } },
    ],
  });
  const outcome = await revised.saveTicket(apis.revised, inputs);
  expect(outcome.status).toBe("conflict");
  expect((await storage.records.read(inputs.ticket.recordId)).value).toEqual({ title: "Other edit" });
  expect((await storage.records.read(inputs.ticket.recordId, { operationId: inputs.saveId })).value).toEqual({
    title: inputs.title,
  });
  expect(inputs.ticket.value).toEqual({ title: "Original" });
});

test("save retries the same captured edit and rejects changed payload under its operation ID", async () => {
  const { apis, inputs } = await createFixture();
  const first = await revised.saveTicket(apis.revised, inputs);
  expect(await revised.saveTicket(apis.revised, inputs)).toEqual(first);
  await expect(revised.saveTicket(apis.revised, { ...inputs, title: "Changed retry" })).rejects.toThrow(
    "Operation identity reused with changed payload",
  );
});

test("attachment helper stores portable metadata and retries without staging bytes again", async () => {
  const { apis, inputs, storage, calls } = await createFixture();
  const id = await revised.attachFile(apis.revised, inputs);
  const record = await storage.records.read(id);
  expect(record.value).toEqual({ parentRecordId: inputs.ticket.recordId, name: inputs.file.name });
  expect(record.asset?.byteLength).toBe(inputs.file.size);
  expect(record.asset?.sha256).toHaveLength(64);
  calls.length = 0;
  expect(await revised.attachFile(apis.revised, inputs)).toBe(id);
  expect(calls).not.toContain("assets.stage");
  await expect(
    revised.attachFile(apis.revised, { ...inputs, file: new File(["changed"], inputs.file.name) }),
  ).rejects.toThrow("operation_payload_changed");
});

test("manual attachment recipe cannot retry after rereading the new revision", async () => {
  const { apis, inputs } = await createFixture();
  await proposal.attachFile(apis.proposal, inputs);
  await expect(proposal.attachFile(apis.proposal, inputs)).rejects.toThrow(
    "Operation identity reused with changed payload",
  );
});
