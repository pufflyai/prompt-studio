import { describe, expect, test } from "bun:test";
import type { HarnessContext, SessionMessage } from "@pstdio/sdk/extensions";
import { createOpencodeHarness } from "./harness";
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
  startServer: async () => "http://localhost:4096",
  serverStore: { read: async () => null, write: async () => {}, clear: async () => {} },
  pingServer: async () => true,
  isPortOpen: async () => true,
});

const harnessDefaults = () => ({
  detect: async () => ({ available: true }),
  getModelsOutput: async () => "",
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

const createQuestionListResponse = () =>
  new Response(
    JSON.stringify([
      {
        id: "que-weather",
        sessionID: "oc-1",
        questions: [
          {
            question: "What's the weather like where you are today?",
            header: "Weather",
            options: [{ label: "Hot" }, { label: "Nice" }],
          },
        ],
        tool: { messageID: "msg-question", callID: "call-question" },
      },
    ]),
  );

const getSessionMessageId = (request: FetchRequestContext) => {
  const messageMatch = request.url.pathname.match(/^\/session\/([^/]+)\/message$/);
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

    if (request.method === "GET" && request.url.pathname === "/question") {
      return createQuestionListResponse();
    }

    if (request.method === "POST" && request.url.pathname === "/question/que-weather/reply") {
      const body = parseJsonBody(request.init) as QuestionReplyBody;
      handlers.onReply?.(body);
      return new Response("true");
    }

    const sessionId = getSessionMessageId(request);
    if (request.method === "GET" && sessionId) {
      return new Response(JSON.stringify(handlers.getSessionMessages(sessionId)));
    }

    if (request.method === "POST" && sessionId) {
      handlers.onFollowUp?.(parseJsonBody(request.init));
      return new Response(JSON.stringify({ info: {}, parts: [] }));
    }

    return new Response("{}", { status: 404 });
  };
};

describe("OpenCode question replies", () => {
  test("answers the pending question request instead of sending a follow-up message", async () => {
    const questionMessage = createRunningQuestionMessage();
    const sessionMessages: Record<string, OpencodeSessionMessage[]> = {
      "oc-1": [{ role: "user", content: [{ type: "text", text: "Ask me about the weather" }] }, questionMessage],
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
    const { patches, sink } = recordingSink();

    const session = await h.resume(ctx, {
      agentSessionId: "oc-1",
      prompt: "What's the weather like where you are today?: Nice",
      sessionId: "host-1",
      cwd: "/repo",
      questionResponse: { answers: [["Nice"]] },
      events: sink,
    });

    const exit = await session.done;
    const messagePatches = patches.filter((patch) => patch.path === "/messages");
    const lastMessages = messagePatches.at(-1)?.value as SessionMessage[];

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

  test("does not get stuck when question status stays queued after reply", async () => {
    const questionMessage = createRunningQuestionMessage();
    const questionPart = "parts" in questionMessage ? questionMessage.parts?.[0] : undefined;
    if (questionPart?.state) {
      questionPart.state = {
        ...questionPart.state,
        status: "queued",
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
    const { patches, sink } = recordingSink();

    const session = await h.resume(ctx, {
      agentSessionId: "oc-1",
      prompt: "What's the weather like where you are today?: Nice",
      sessionId: "host-1",
      cwd: "/repo",
      questionResponse: { answers: [["Nice"]] },
      events: sink,
    });

    const exit = await session.done;
    const messagePatches = patches.filter((patch) => patch.path === "/messages");
    const lastMessages = messagePatches.at(-1)?.value as SessionMessage[];

    expect(exit).toEqual({ status: "completed" });
    expect(replyBodies).toEqual([{ answers: [["Nice"]] }]);
    expect(lastMessages.at(-1)?.parts[0]).toMatchObject({
      type: "tool",
      tool: "question",
      state: { metadata: { answers: [["Nice"]] } },
    });
  }, 15_000);

  test("waits for a delayed assistant continuation after answering a question", async () => {
    const questionMessage = createRunningQuestionMessage();
    const questionPart = "parts" in questionMessage ? questionMessage.parts?.[0] : undefined;
    if (questionPart?.state) {
      questionPart.state = {
        ...questionPart.state,
        status: "queued",
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
    const { patches, sink } = recordingSink();

    const session = await h.resume(ctx, {
      agentSessionId: "oc-1",
      prompt: "What's the weather like where you are today?: Nice",
      sessionId: "host-1",
      cwd: "/repo",
      questionResponse: { answers: [["Nice"]] },
      events: sink,
    });

    const exit = await session.done;
    const messagePatches = patches.filter((patch) => patch.path === "/messages");
    const lastMessages = messagePatches.at(-1)?.value as SessionMessage[];

    expect(exit).toEqual({ status: "completed" });
    expect(lastMessages.at(-1)?.parts[0]).toEqual({ type: "text", text: "Thanks, TypeScript works." });
  }, 15_000);
});
