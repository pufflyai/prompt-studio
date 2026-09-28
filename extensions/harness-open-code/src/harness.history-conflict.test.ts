import { expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/sdk/extensions";
import { HistoryConflict } from "@pstdio/sdk/extensions";
import { createOpencodeHarness } from "./harness";
import { ctx, harnessDefaults, serviceOverrides } from "./harness.test-helpers";
import { recordingSink, userMessage } from "./opencode-session-poller.test-helpers";

const failure: SessionMessage = {
  id: "opencode-error-oc-1-1",
  role: "system",
  parts: [{ type: "error", errorType: "other", message: "local failure" }],
};

test("a turn that stops on a history conflict also stops the OpenCode turn", async () => {
  let abortCalls = 0;
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (method === "POST" && url.includes("/session?")) return new Response(JSON.stringify({ id: "oc-1" }));
    if (method === "POST" && url.includes("/session/oc-1/message")) return new Promise<Response>(() => {});
    if (method === "POST" && url.includes("/session/oc-1/abort")) {
      abortCalls += 1;
      return new Response("true");
    }
    // Two identical prompts leave the saved failure without a single owner.
    if (method === "GET" && url.includes("/session/oc-1/message")) {
      return new Response(JSON.stringify([userMessage("again"), userMessage("again")]));
    }
    return new Response("{}", { status: 404 });
  };
  const { sink } = recordingSink();
  const user: SessionMessage = { id: "old-user", role: "user", parts: [{ type: "text", text: "again" }] };
  sink.push({ op: "replace", path: "/messages", value: [user, failure] });
  const h = createOpencodeHarness(harnessDefaults(), { ...serviceOverrides(), fetcher });

  const session = await h.start(ctx, { prompt: "again", sessionId: "host-1", cwd: "/test", events: sink });

  await expect(session.done).rejects.toThrow(HistoryConflict);
  expect(abortCalls).toBe(1);
});
