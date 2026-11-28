import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { createOpencodeHarness } from "./harness";
import { acceptedPrompt, nativeMessagesResponse } from "./native-api.test-helpers";
import { recordingSink } from "./opencode-session-poller.test-helpers";
import type { OpencodeSessionMessage } from "./opencode-types";

const ctx: HarnessContext = {
  extensionId: "pstdio.harness-open-code",
  name: "harness-open-code",
  connections: {
    request: async () => {
      throw new Error("No connections are configured in this test");
    },
    stream: async function* () {
      yield { type: "end" } as const;
    },
  },
  process: {
    run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    runOrThrow: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    spawnDetached: async () => ({}),
  },
  net: { findFreePort: async () => 0 },
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  state: { get: async () => undefined, set: async () => {}, delete: async () => {} },
};

const serviceOverrides = () => ({
  startServer: async () => ({ running: true, url: "http://localhost:4096", dispose: async () => {} }),
  serverStore: { read: async () => null, write: async () => {}, clear: async () => {} },
  pingServer: async () => true,
  isPortOpen: async () => true,
});

const harnessDefaults = () => ({
  detect: async () => ({ available: true }),
  getModelsOutput: async () => "",
  pollIntervalMs: 1,
});

const createRunningQuestionMessage = (): OpencodeSessionMessage => ({
  info: {
    id: "msg-question",
    role: "assistant",
    time: { created: Date.now() },
  },
  parts: [
    {
      type: "tool",
      tool: "question",
      callID: "call-question",
      state: {
        status: "running",
        input: {
          questions: [
            {
              question: "What's the weather like where you are today?",
              header: "Weather",
              options: [{ label: "Hot" }, { label: "Nice" }],
            },
          ],
        },
      },
    },
  ],
});

interface QuestionReplyBody {
  answers: string[][];
}

interface FetchRequestContext {
  url: URL;
  method: string;
  init: RequestInit | undefined;
}

interface QuestionReplyFetcherInput {
  getSessionMessages: (sessionId: string) => OpencodeSessionMessage[];
  onReply?: (body: QuestionReplyBody) => void;
  onFollowUp?: (body: unknown) => void;
}

const parseFetchRequest = (input: RequestInfo | URL, init?: RequestInit) => ({
  url: new URL(String(input)),
  method: init?.method ?? "GET",
  init,
});

const parseJsonBody = (init: RequestInit | undefined) => JSON.parse(init?.body as string);

const questionForm = {
  id: "frm_weather",
  sessionID: "oc-1",
  title: "Weather",
  metadata: { kind: "question", tool: { messageID: "msg-question", id: "call-question" } },
  fields: [
    {
      type: "string",
      key: "weather",
      title: "Weather",
      options: [
        { value: "hot", label: "Hot" },
        { value: "nice", label: "Nice" },
      ],
    },
  ],
};
const createQuestionListResponse = () => Response.json({ data: [questionForm] });

const getSessionMessageId = (request: FetchRequestContext) => {
  const messageMatch = request.url.pathname.match(/^\/api\/session\/([^/]+)\/message$/);
  return messageMatch?.[1] ?? null;
};

const completeQuestionMessage = (questionMessage: OpencodeSessionMessage, answers: string[][]) => {
  const part = "parts" in questionMessage ? questionMessage.parts?.[0] : undefined;
  if (part?.state) {
    part.state = {
      ...part.state,
      status: "completed",
      output: "User has answered your questions.",
      metadata: { answers },
    };
  }

  if ("info" in questionMessage) {
    questionMessage.info = {
      ...questionMessage.info,
      time: { ...questionMessage.info?.time, completed: Date.now() },
    };
  }
};

const createQuestionReplyFetcher = (handlers: QuestionReplyFetcherInput) => {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = parseFetchRequest(input, init);

    if (request.method === "GET" && request.url.pathname === "/api/session/oc-1/form") {
      return createQuestionListResponse();
    }

    if (request.method === "POST" && request.url.pathname === "/api/session/oc-1/form/frm_weather/reply") {
      const native = parseJsonBody(request.init) as { answer: { weather: string } };
      const body = { answers: [[native.answer.weather === "nice" ? "Nice" : "Hot"]] };
      handlers.onReply?.(body);
      return new Response("true");
    }

    if (request.url.pathname === "/api/session/oc-1/form/frm_weather") return Response.json({ data: questionForm });
    const sessionId = getSessionMessageId(request);
    if (request.method === "GET" && sessionId) {
      // Each poll stands for one production poll interval, so idle grace periods still span the same number of polls.
      if (advanceClock) setSystemTime(Date.now() + 1_000);
      return nativeMessagesResponse(handlers.getSessionMessages(sessionId));
    }

    if (request.method === "POST" && sessionId) {
      handlers.onFollowUp?.(parseJsonBody(request.init));
      return acceptedPrompt();
    }

    return new Response("{}", { status: 404 });
  };
};

test("a follow-up held behind a question can expose the question and continue after its answer", async () => {
  const question = createRunningQuestionMessage();
  const messages = [question];
  const idle = Promise.withResolvers<Response>();
  let queuedText = "";
  const posts: string[] = [];
  const fallback = createQuestionReplyFetcher({
    getSessionMessages: () => messages,
    onReply: (body) => {
      completeQuestionMessage(question, body.answers);
      messages.push({
        info: { id: "continued", role: "assistant", time: { created: Date.now(), completed: Date.now() } },
        parts: [{ type: "text", text: `Answered ${body.answers[0]![0]}; applied ${queuedText}` }],
      });
      idle.resolve(Response.json({}));
    },
  });
  const h = createOpencodeHarness(harnessDefaults(), {
    ...serviceOverrides(),
    fetcher: (input, init) => {
      const path = new URL(String(input)).pathname;
      if (init?.method === "POST") posts.push(path);
      if (path === "/api/session/oc-1/prompt") {
        queuedText = parseJsonBody(init).text;
        return Promise.resolve(acceptedPrompt());
      }
      if (path === "/api/experimental/session/oc-1/wait") return idle.promise;
      return fallback(input, init);
    },
  });
  const { sink } = recordingSink();
  const input = { agentSessionId: "oc-1", sessionId: "host-1", cwd: "/repo", events: sink };
  try {
    const followUp = await h.resume(ctx, { ...input, prompt: "Break down workspaces by template" });
    const settled = await Promise.race([followUp.done, Bun.sleep(100).then(() => null)]);
    if (!settled) await followUp.stop();
    expect(settled).toEqual({ status: "completed" });
    expect(sink.getMessages().at(-1)?.parts[0]).toMatchObject({ tool: "question", status: "running" });

    const answer = await h.resume(ctx, {
      ...input,
      prompt: "Nice",
      questionResponse: { callId: "call-question", answers: [["Nice"]] },
    });
    expect(await answer.done).toEqual({ status: "completed" });
    expect(sink.getMessages().at(-1)?.parts).toContainEqual({
      type: "text",
      text: "Answered Nice; applied Break down workspaces by template",
    });
    expect(posts.filter((path) => path.endsWith("/prompt"))).toHaveLength(1);
    expect(posts.filter((path) => path.endsWith("/reply"))).toEqual(["/api/session/oc-1/form/frm_weather/reply"]);
  } finally {
    idle.resolve(Response.json({}));
    await h.dispose!(ctx);
  }
});

// A poller that outlives a failed test must not freeze the clock for later files in this process.
let advanceClock = false;

describe("OpenCode question replies", () => {
  beforeEach(() => {
    advanceClock = true;
  });

  afterEach(() => {
    advanceClock = false;
    setSystemTime();
  });

  test.each([
    "call-question",
    undefined,
  ])("routes replies with multiple pending forms and call ID %s", async (callId) => {
    const questionMessage = createRunningQuestionMessage();
    const posted: string[] = [];
    const fallback = createQuestionReplyFetcher({
      getSessionMessages: () => [questionMessage],
      onReply: (body) => completeQuestionMessage(questionMessage, body.answers),
    });
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if ((init?.method ?? "GET") === "GET" && url.pathname === "/api/session/oc-1/form")
        return Response.json({
          data: [
            {
              ...questionForm,
              id: "frm_other",
              metadata: { kind: "question", tool: { messageID: "other", id: "other" } },
            },
            questionForm,
          ],
        });
      if (init?.method === "POST") posted.push(url.pathname);
      return fallback(input, init);
    };
    const h = createOpencodeHarness(harnessDefaults(), { ...serviceOverrides(), fetcher });
    try {
      const reply = h.resume(ctx, {
        agentSessionId: "oc-1",
        sessionId: "host-1",
        prompt: "Nice",
        cwd: "/repo",
        questionResponse: { ...(callId ? { callId } : {}), answers: [["Nice"]] },
        events: recordingSink().sink,
      });
      if (callId) {
        expect(await (await reply).done).toEqual({ status: "completed" });
        expect(posted).toEqual(["/api/session/oc-1/form/frm_weather/reply"]);
      } else {
        await expect(reply).rejects.toMatchObject({ questionRejected: true });
        expect(posted).toEqual([]);
      }
    } finally {
      await h.dispose!(ctx);
    }
  });

  test("a stale question answer cannot fall back to another pending form", async () => {
    const posts: string[] = [];
    const fallback = createQuestionReplyFetcher({ getSessionMessages: () => [createRunningQuestionMessage()] });
    const h = createOpencodeHarness(harnessDefaults(), {
      ...serviceOverrides(),
      fetcher: (input, init) => {
        if (init?.method === "POST") posts.push(String(input));
        return fallback(input, init);
      },
    });
    try {
      await expect(
        h.resume(ctx, {
          agentSessionId: "oc-1",
          sessionId: "host-1",
          prompt: "Nice",
          cwd: "/repo",
          questionResponse: { callId: "expired", answers: [["Nice"]] },
          events: recordingSink().sink,
        }),
      ).rejects.toMatchObject({ questionRejected: true });
      expect(posts).toEqual([]);
    } finally {
      await h.dispose!(ctx);
    }
  });

  test("answers the pending question request instead of sending a follow-up message", async () => {
    const questionMessage = createRunningQuestionMessage();
    const sessionMessages: Record<string, OpencodeSessionMessage[]> = {
      "oc-1": [
        {
          info: { id: "msg_earlier", role: "assistant", time: { created: 1, completed: 2 } },
          parts: [
            {
              type: "tool",
              tool: "question",
              callID: "call_earlier",
              state: { status: "completed", input: {}, output: "answered earlier" },
            },
          ],
        },
        { role: "user", content: [{ type: "text", text: "Ask me about the weather" }] },
        questionMessage,
      ],
    };
    const replyBodies: unknown[] = [];
    const normalFollowUps: unknown[] = [];

    const fetcher = createQuestionReplyFetcher({
      getSessionMessages: (sessionId) => sessionMessages[sessionId] ?? [],
      onReply: (body) => {
        replyBodies.push(body);
        completeQuestionMessage(questionMessage, body.answers);
      },
      onFollowUp: (body) => normalFollowUps.push(body),
    });

    const h = createOpencodeHarness(harnessDefaults(), { ...serviceOverrides(), fetcher });
    const { sink } = recordingSink();

    const session = await h.resume(ctx, {
      agentSessionId: "oc-1",
      prompt: "What's the weather like where you are today?: Nice",
      sessionId: "host-1",
      cwd: "/repo",
      questionResponse: { answers: [["Nice"]] },
      events: sink,
    });

    const exit = await session.done;
    const lastMessages = sink.getMessages();

    expect(exit).toEqual({ status: "completed" });
    expect(normalFollowUps).toEqual([]);
    expect(replyBodies).toEqual([{ answers: [["Nice"]] }]);
    expect(lastMessages.at(-1)?.parts[0]).toMatchObject({
      type: "tool",
      tool: "question",
      status: "completed",
      state: { status: "completed", metadata: { answers: [["Nice"]] } },
    });
  });

  test("does not get stuck when question status stays running after reply", async () => {
    const questionMessage = createRunningQuestionMessage();
    const questionPart = "parts" in questionMessage ? questionMessage.parts?.[0] : undefined;
    if (questionPart?.state) {
      questionPart.state = {
        ...questionPart.state,
        status: "running",
        output: "",
      };
    }
    const sessionMessages: Record<string, OpencodeSessionMessage[]> = {
      "oc-1": [{ role: "user", content: [{ type: "text", text: "Ask me about the weather" }] }, questionMessage],
    };
    const replyBodies: unknown[] = [];

    const fetcher = createQuestionReplyFetcher({
      getSessionMessages: (sessionId) => sessionMessages[sessionId] ?? [],
      onReply: (body) => replyBodies.push(body),
    });

    const h = createOpencodeHarness(harnessDefaults(), { ...serviceOverrides(), fetcher });
    const { sink } = recordingSink();

    const session = await h.resume(ctx, {
      agentSessionId: "oc-1",
      prompt: "What's the weather like where you are today?: Nice",
      sessionId: "host-1",
      cwd: "/repo",
      questionResponse: { answers: [["Nice"]] },
      events: sink,
    });

    const exit = await session.done;
    const lastMessages = sink.getMessages();

    expect(exit).toEqual({ status: "completed" });
    expect(replyBodies).toEqual([{ answers: [["Nice"]] }]);
    expect(lastMessages.at(-1)?.parts[0]).toMatchObject({
      type: "tool",
      tool: "question",
      state: { metadata: { answers: [["Nice"]] } },
    });
  });

  test("waits for a delayed assistant continuation after answering a question", async () => {
    const questionMessage = createRunningQuestionMessage();
    const questionPart = "parts" in questionMessage ? questionMessage.parts?.[0] : undefined;
    if (questionPart?.state) {
      questionPart.state = {
        ...questionPart.state,
        status: "running",
      };
    }
    const continuationMessage: OpencodeSessionMessage = {
      role: "assistant",
      content: [{ type: "text", text: "Thanks, TypeScript works." }],
    };
    const replyBodies: unknown[] = [];
    let messageGetsAfterReply = 0;

    const fetcher = createQuestionReplyFetcher({
      getSessionMessages: () => {
        if (replyBodies.length > 0) messageGetsAfterReply += 1;
        const messages = [
          { role: "user", content: [{ type: "text", text: "Ask me about the weather" }] },
          questionMessage,
        ];
        return messageGetsAfterReply >= 5 ? [...messages, continuationMessage] : messages;
      },
      onReply: (body) => replyBodies.push(body),
    });

    const h = createOpencodeHarness(harnessDefaults(), { ...serviceOverrides(), fetcher });
    const { sink } = recordingSink();

    const session = await h.resume(ctx, {
      agentSessionId: "oc-1",
      prompt: "What's the weather like where you are today?: Nice",
      sessionId: "host-1",
      cwd: "/repo",
      questionResponse: { answers: [["Nice"]] },
      events: sink,
    });

    const exit = await session.done;
    const lastMessages = sink.getMessages();

    expect(exit).toEqual({ status: "completed" });
    expect(lastMessages.at(-1)?.parts[0]).toEqual({ type: "text", text: "Thanks, TypeScript works." });
  });
});
