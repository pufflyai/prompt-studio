import { expect, test } from "bun:test";
import { submitComposerResponse } from "./composer-decision";

test("native question replies never consume draft attachments", async () => {
  const sent: unknown[] = [];
  let cleared = false;
  const response = { callId: "native-request", answers: [["Browser"]] };
  await submitComposerResponse({
    text: "Browser",
    response,
    attachments: ["saved-draft-file"],
    onSubmit: async (...args) => {
      sent.push(args);
    },
    onClearAttachments: () => {
      cleared = true;
    },
  });
  expect(sent).toEqual([["Browser", [], response]]);
  expect(cleared).toBe(false);
});

test("ordinary messages send and clear their attachments after acceptance", async () => {
  const sent: unknown[] = [];
  let cleared = false;
  await submitComposerResponse({
    text: "Follow-up",
    attachments: ["draft-file"],
    onSubmit: async (...args) => {
      sent.push(args);
    },
    onClearAttachments: () => {
      cleared = true;
    },
  });
  expect(sent).toEqual([["Follow-up", ["draft-file"], undefined]]);
  expect(cleared).toBe(true);
});
