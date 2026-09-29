import { expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/sdk/extensions";
import { createOpencodeHarness } from "./harness";
import { ctx, harnessDefaults, serviceOverrides } from "./harness.test-helpers";
import {
  completedAssistant,
  inFlightAssistant,
  recordingSink,
  userMessage,
} from "./opencode-session-poller.test-helpers";

const failure: SessionMessage = {
  id: "opencode-error-oc-1-1",
  role: "system",
  parts: [{ type: "error", errorType: "other", message: "local failure" }],
};

test.each([
  "start",
  "resume",
  "reattach",
] as const)("%s keeps an ambiguous saved turn while OpenCode completes without an abort", async (operation) => {
  let abortCalls = 0;
  let reads = 0;
  const warnings: string[] = [];
  const readMessages = () => {
    reads += 1;
    const users = [userMessage("again"), userMessage("again")];
    if (operation === "resume" && reads === 1) return new Response(JSON.stringify(users));
    const lastRead = operation === "resume" ? 3 : 2;
    const assistant = reads >= lastRead ? completedAssistant("done") : inFlightAssistant("working");
    return new Response(JSON.stringify([...users, assistant]));
  };
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
      return readMessages();
    }
    return new Response("{}", { status: 404 });
  };
  const { sink, patches } = recordingSink();
  const user: SessionMessage = {
    id: "old-user",
    role: "user",
    parts: [
      { type: "text", text: "again" },
      { type: "file", fileId: "attachment", url: "/attachment" },
    ],
  };
  sink.push({ op: "replace", path: "/messages", value: [user, failure] });
  const h = createOpencodeHarness(harnessDefaults(), { ...serviceOverrides(), fetcher });

  const context = {
    ...ctx,
    logger: {
      ...ctx.logger,
      warn: (message: string) => {
        warnings.push(message);
      },
    },
  };
  const input = { prompt: "again", sessionId: "host-1", agentSessionId: "oc-1", cwd: "/test", events: sink };
  const session = await h[operation]!(context, input);

  expect(await session.done).toEqual({ status: "completed" });
  expect(abortCalls).toBe(0);
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain("oc-1");
  expect(warnings[0]).not.toContain("again");
  expect(sink.getMessages()).toContainEqual(user);
  expect(sink.getMessages().filter((message) => message.id === failure.id)).toEqual([failure]);
  expect(sink.getMessages().at(-1)?.parts).toEqual([{ type: "text", text: "done" }]);
  expect(patches.some((patch) => patch.path === "/history_issue")).toBe(false);
});
