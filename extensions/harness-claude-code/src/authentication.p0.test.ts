import { expect, test } from "bun:test";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { getClaudeAuthentication } from "./authentication";

const context = (stdout: string, exitCode = 0) =>
  ({
    process: { run: async () => ({ stdout, stderr: "", exitCode }) },
  }) as unknown as HarnessContext;

test("reads Claude's native JSON account status and offers native sign-out", async () => {
  expect(await getClaudeAuthentication(context('{"loggedIn":true,"authMethod":"claude.ai"}'))).toMatchObject({
    status: "signed_in",
    providers: [expect.objectContaining({ id: "anthropic", canLogout: true })],
  });
  expect((await getClaudeAuthentication(context('{"loggedIn":false}', 1))).status).toBe("signed_out");
});

test("does not offer to remove credentials owned by the runtime environment", async () => {
  const result = await getClaudeAuthentication(context('{"loggedIn":true,"authMethod":"oauth_token"}'));
  expect(result.status).toBe("signed_in");
  expect(result.providers[0]!.canLogout).toBe(false);
  expect((await getClaudeAuthentication(context("bad response", 2))).status).toBe("unknown");
});
