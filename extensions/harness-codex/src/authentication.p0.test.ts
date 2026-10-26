import { expect, test } from "bun:test";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { getCodexAuthentication } from "./authentication";

const ctx = {} as HarnessContext;
test("Codex account readiness follows native authentication requirements without exposing account details", async () => {
  const state = await getCodexAuthentication(ctx, undefined, async () => ({
    account: { type: "chatgpt" },
    requiresOpenaiAuth: true,
  }));
  expect(state.status).toBe("signed_in");
  expect(state.providers[0]!.canLogout).toBe(true);
  expect(
    (await getCodexAuthentication(ctx, undefined, async () => ({ account: null, requiresOpenaiAuth: true }))).status,
  ).toBe("signed_out");
  expect(
    (await getCodexAuthentication(ctx, undefined, async () => ({ account: null, requiresOpenaiAuth: false }))).status,
  ).toBe("not_required");
  expect(
    (
      await getCodexAuthentication(ctx, undefined, async () => {
        throw new Error("Disconnected");
      })
    ).status,
  ).toBe("unknown");
});
