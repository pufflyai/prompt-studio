import { expect, test } from "bun:test";
import { submitBookForm } from "./book-form-submission";

test("draft cleanup failure closes a form whose creation is acknowledged", async () => {
  const stages: string[] = [];
  await expect(
    submitBookForm({
      persist: async () => {
        stages.push("draft");
      },
      submit: async () => {
        stages.push("create");
      },
      discard: async () => {
        throw new Error("The draft could not be removed");
      },
      close: () => {
        stages.push("close");
      },
    }),
  ).rejects.toThrow("The draft could not be removed");
  expect(stages).toEqual(["draft", "create", "close"]);
});

test("an unresolved creation keeps the submitted draft and the form available", async () => {
  const stages: string[] = [];
  await expect(
    submitBookForm({
      persist: async () => {
        stages.push("draft");
      },
      submit: async () => {
        throw new Error("The response was lost");
      },
      discard: async () => {
        stages.push("discard");
      },
      close: () => {
        stages.push("close");
      },
    }),
  ).rejects.toThrow("The response was lost");
  expect(stages).toEqual(["draft"]);
});
