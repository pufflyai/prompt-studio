import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { readDraft, saveDraft } from "./drafts";

test("cloud drafts retain large text, files, controls and recovery bodies without a local folder", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      extensionFiles: {
        readText: async () => {
          throw new Error("No project folder");
        },
        writeText: async () => {
          throw new Error("No project folder");
        },
      },
    },
  });
  const draft = {
    text: "Unsent ".repeat(12_000),
    attachments: [{ id: "file", name: "image.png", mediaType: "image/png" }],
    values: { harness: { harnessId: "agent", model: "B", params: { thinking: "high" } }, device: "laptop" },
    recovered: [{ text: "Earlier unsent work", attachments: [{ id: "old", name: "old.txt" }], values: {} }],
  };
  await saveDraft(ctx, "draft-one", draft);
  const reloaded = makeCommandContext({ storage, params: {} });
  expect(await readDraft(reloaded, "draft-one")).toEqual(draft);
  await saveDraft(reloaded, "draft-two", { text: "Other conversation", attachments: [], values: {} });
  expect((await readDraft(reloaded, "draft-one")).attachments).toEqual(draft.attachments);
  expect((await readDraft(reloaded, "draft-two")).text).toBe("Other conversation");
  const otherProject = makeCommandContext({ storage: createMemoryStorage(), params: {}, projectId: "other" });
  expect((await readDraft(otherProject, "draft-one")).text).toBe("");
});
