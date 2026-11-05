import { expect, test } from "bun:test";
import { collectFormAnswers } from "./opencode-forms";

test("custom and empty native choices allow input, while fixed choices keep their values", async () => {
  const prompts: unknown[] = [];
  const replies = ["work", "default", "region-id"];
  const answer = await collectFormAnswers(
    [
      {
        type: "string",
        key: "profile",
        title: "Profile",
        custom: true,
        options: [{ value: "default", label: "Default" }],
      },
      { type: "string", key: "empty", title: "Empty", options: [] },
      { type: "string", key: "region", title: "Region", options: [{ value: "region-id", label: "Region name" }] },
      { type: "string", key: "hidden", hidden: true, default: "native-default" },
      { type: "string", key: "skipped", when: [{ key: "profile", op: "eq", value: "personal" }] },
    ],
    {
      signal: new AbortController().signal,
      emit: async () => {},
      request: async (prompt) => {
        prompts.push(prompt);
        return replies.shift()!;
      },
    },
  );
  expect(answer).toEqual({ profile: "work", empty: "default", region: "region-id", hidden: "native-default" });
  expect(prompts).toMatchObject([
    { type: "input" },
    { type: "input" },
    { type: "select", options: [{ id: "region-id", label: "Region name" }] },
  ]);
});
