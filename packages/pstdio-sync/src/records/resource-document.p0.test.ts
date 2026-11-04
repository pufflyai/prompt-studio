import { expect, test } from "bun:test";
import { editResourceDocument, mergeResourceDocument } from "./resource-document";

test("a resource document keeps one record's value, shared edits, deletion and restore", async () => {
  const states: Uint8Array[] = [];
  const save = async (edit: Parameters<typeof editResourceDocument>[1]) => {
    const result = await editResourceDocument(states, edit, false);
    if (result.update) states.push(result.update);
    return result.record;
  };
  expect(await save({ recordId: "note", replace: { title: "Draft", tags: ["a"] } })).toMatchObject({
    exists: true,
    deleted: false,
    value: { title: "Draft", tags: ["a"] },
  });
  expect(await save({ recordId: "note", shared: [{ kind: "text.insert", index: 0, text: "Hello" }] })).toMatchObject({
    shared: { kind: "text", value: "Hello" },
  });
  expect(await save({ recordId: "note", deleted: true })).toMatchObject({ exists: true, deleted: true, value: null });
  const restored = await save({ recordId: "note", deleted: false, replace: { title: "Back" } });
  expect(restored).toMatchObject({ deleted: false, value: { title: "Back" } });

  const folded = await editResourceDocument(states, { recordId: "note", replace: { title: "Folded" } }, true);
  const reopened = await editResourceDocument([folded.checkpoint!], { recordId: "note", asset: null }, false);
  expect(reopened.record.value).toEqual({ title: "Folded" });
});

test("an invalid shared edit is rejected before the document changes", async () => {
  const first = await editResourceDocument([], { recordId: "note", replace: "text" }, false);
  await expect(
    editResourceDocument(
      [first.update!],
      { recordId: "note", shared: [{ kind: "text.delete", index: 9, count: 1 }] },
      false,
    ),
  ).rejects.toThrow("outside");
});

test("a serialized writer continues after checkpoints and merges with an independent offline writer", async () => {
  const base = await editResourceDocument([], { recordId: "note", replace: { title: "Draft", body: "" } }, true);
  const first = await editResourceDocument(
    [base.checkpoint!],
    { recordId: "note", replace: { title: "First", body: "" } },
    true,
    undefined,
    10,
  );
  const second = await editResourceDocument(
    [first.checkpoint!],
    { recordId: "note", replace: { title: "Second", body: "" } },
    false,
    undefined,
    10,
  );
  const offline = await editResourceDocument(
    [base.checkpoint!],
    { recordId: "note", replace: { title: "Draft", body: "Offline" } },
    true,
    undefined,
    20,
  );
  for (const incoming of [
    [second.update!, offline.checkpoint!],
    [offline.checkpoint!, second.update!],
  ]) {
    const merged = await mergeResourceDocument("note", [first.checkpoint!], incoming, { checkpoint: true });
    expect(merged.record.value).toEqual({ title: "Second", body: "Offline" });
    const continued = await editResourceDocument(
      [merged.checkpoint!],
      { recordId: "note", replace: { title: "After merge", body: "Offline" } },
      true,
      undefined,
      10,
    );
    expect(continued.record.value).toEqual({ title: "After merge", body: "Offline" });
  }
});
