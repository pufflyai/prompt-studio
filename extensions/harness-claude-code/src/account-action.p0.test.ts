import { expect, test } from "bun:test";
import { runClaudeAccountLogin } from "./account-action";

test("Claude login relays the native browser link and private code, then waits for native success", async () => {
  const prompts: unknown[] = [];
  await runClaudeAccountLogin(
    "claudeai",
    {
      signal: new AbortController().signal,
      emit: async (prompt) => {
        prompts.push(prompt);
      },
      request: async () => "private-code",
    },
    [
      process.execPath,
      "-e",
      "process.stdout.write('Visit https://claude.com/oauth?state=fixture\\nPaste code here if prompted > ');process.stdin.once('data',value=>process.exit(String(value).trim()==='private-code'?0:1));",
    ],
  );
  expect(prompts).toEqual([{ type: "browser", url: "https://claude.com/oauth?state=fixture" }]);
});
