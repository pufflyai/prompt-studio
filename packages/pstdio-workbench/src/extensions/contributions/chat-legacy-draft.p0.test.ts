import { expect, test } from "bun:test";
import { transferLegacyChatDraft } from "./chat-legacy-draft";

const empty = { text: "", attachments: [], values: {} };
test("legacy unsent work is durable before acknowledgement, preserving native and legacy bodies", async () => {
  const events: string[] = [];
  const legacy = {
    draft: { ...empty, text: "Legacy", attachments: [{ id: "old-file", name: "image.png" }] },
    acknowledge: () => {
      events.push("acknowledged");
    },
  };
  const result = await transferLegacyChatDraft(
    async () => ({ ...empty, text: "Newer" }),
    async (draft) => {
      expect(draft).toMatchObject({
        text: "Newer",
        recovered: [{ text: "Legacy", attachments: legacy.draft.attachments }],
      });
      events.push("saved");
    },
    legacy,
  );
  expect(result.recovered).toHaveLength(1);
  expect(events).toEqual(["saved", "acknowledged"]);
  const migrated = await transferLegacyChatDraft(
    async () => ({ ...empty, values: { workspace: "ws" } }),
    async () => {},
    legacy,
  );
  expect(migrated).toMatchObject({
    text: "Legacy",
    values: { workspace: "ws" },
    attachments: legacy.draft.attachments,
  });
});

test("a failed destination write leaves legacy data available for another attempt", async () => {
  let acknowledged = false;
  await expect(
    transferLegacyChatDraft(
      async () => empty,
      async () => {
        throw new Error("Offline");
      },
      {
        draft: { ...empty, text: "Keep" },
        acknowledge: () => {
          acknowledged = true;
        },
      },
    ),
  ).rejects.toThrow("Offline");
  expect(acknowledged).toBe(false);
});
