import { expect, test } from "bun:test";
import { editResourceDocument } from "./resource-document";

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
