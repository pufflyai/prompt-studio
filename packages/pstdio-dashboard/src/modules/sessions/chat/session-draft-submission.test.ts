import { expect, test } from "bun:test";
import { sessionDraftSubmission } from "./session-draft-submission";

const draftFile = {
  file_id: "draft-file",
  name: "draft.txt",
  size_bytes: 8,
  mime_type: "text/plain",
  hash: null,
  url: "/draft.txt",
  created_at: "2026-10-04",
  updated_at: "2026-10-04",
};

test("question replies preserve draft files and never invoke draft acceptance", async () => {
  let cleared = false;
  const response = { callId: "request", answers: [["Yes"]] };
  const submit = sessionDraftSubmission(
    async (text, attachments, answer, onSubmitted) => {
      expect(text).toBe("Yes");
      expect(attachments).toEqual([]);
      expect(answer).toEqual(response);
      onSubmitted?.();
    },
    [draftFile],
    () => {
      cleared = true;
    },
  );
  await submit("Yes", [], response);
  expect(cleared).toBe(false);
});

test("ordinary messages clear the draft only on server acceptance", async () => {
  let cleared = false;
  const submit = sessionDraftSubmission(
    async (_text, attachments, _response, onSubmitted) => {
      expect(attachments[0].file_id).toBe("draft-file");
      expect(cleared).toBe(false);
      onSubmitted?.();
    },
    [draftFile],
    () => {
      cleared = true;
    },
  );
  await submit("Send the draft", []);
  expect(cleared).toBe(true);
});
