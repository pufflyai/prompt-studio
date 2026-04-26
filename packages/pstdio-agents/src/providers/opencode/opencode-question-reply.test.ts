import { describe, expect, test } from "bun:test";
import { createEventStore } from "../../services/event-store";
import type { JsonPatch, SessionMessage } from "../../types";
import { createOpencodeAgent } from "./opencode-agent";
import type { OpencodeSessionMessage } from "./opencode-types";

const serviceOverrides = () => ({
  startServer: async () => "http://localhost:4096",
  serverStore: { read: async () => null, write: async () => {}, clear: async () => {} },
  pingServer: async () => true,
  isPortOpen: async () => true,
});

const agentDefaults = () => ({
  isCommandAvailable: () => true,
  getModelsOutput: () => "",
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

describe("OpenCode question replies", () => {
  test("answers the pending question request instead of sending a follow-up message", async () => {
    const questionMessage = createRunningQuestionMessage();
    const sessionMessages: Record<string, OpencodeSessionMessage[]> = {
      "oc-1": [{ role: "user", content: [{ type: "text", text: "Ask me about the weather" }] }, questionMessage],
    };
    const replyBodies: unknown[] = [];
    const normalFollowUps: unknown[] = [];

    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";

      if (method === "GET" && url.pathname === "/question") {
        return new Response(
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
      }

      if (method === "POST" && url.pathname === "/question/que-weather/reply") {
        const body = JSON.parse(init?.body as string);
        replyBodies.push(body);
        const part = "parts" in questionMessage ? questionMessage.parts?.[0] : undefined;
        if (part?.state) {
          part.state = {
            ...part.state,
            status: "completed",
            output: "User has answered your questions.",
            metadata: { answers: body.answers },
          };
        }
        if ("info" in questionMessage) {
          questionMessage.info = {
            ...questionMessage.info,
            time: { ...questionMessage.info?.time, completed: Date.now() },
          };
        }
        return new Response("true");
      }

      const messageMatch = url.pathname.match(/^\/session\/([^/]+)\/message$/);
      if (method === "GET" && messageMatch) {
        return new Response(JSON.stringify(sessionMessages[messageMatch[1]!] ?? []));
      }

      if (method === "POST" && messageMatch) {
        normalFollowUps.push(JSON.parse(init?.body as string));
        return new Response(JSON.stringify({ info: {}, parts: [] }));
      }

      return new Response("{}", { status: 404 });
    };

    const a = createOpencodeAgent(agentDefaults(), { ...serviceOverrides(), fetcher });
    const eventStore = createEventStore();

    const result = await a.resumeSession(
      {
        sessionId: "oc-1",
        prompt: "What's the weather like where you are today?: Nice",
        cwd: "/repo",
        questionResponse: { answers: [["Nice"]] },
      },
      eventStore,
    );

    const exit = await result.process!.onExit;
    const messagePatches = eventStore.getHistory().filter((patch: JsonPatch) => patch.path === "/messages");
    const lastMessages = messagePatches.at(-1)?.value as SessionMessage[];

    expect(exit.code).toBe(0);
    expect(normalFollowUps).toEqual([]);
    expect(replyBodies).toEqual([{ answers: [["Nice"]] }]);
    expect(lastMessages.at(-1)?.parts[0]).toMatchObject({
      type: "tool",
      tool: "question",
      status: "completed",
      state: { status: "completed", metadata: { answers: [["Nice"]] } },
    });

    eventStore.close();
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

    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";

      if (method === "GET" && url.pathname === "/question") {
        return new Response(
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
      }

      if (method === "POST" && url.pathname === "/question/que-weather/reply") {
        replyBodies.push(JSON.parse(init?.body as string));
        return new Response("true");
      }

      const messageMatch = url.pathname.match(/^\/session\/([^/]+)\/message$/);
      if (method === "GET" && messageMatch) {
        return new Response(JSON.stringify(sessionMessages[messageMatch[1]!] ?? []));
      }

      if (method === "POST" && messageMatch) {
        return new Response(JSON.stringify({ info: {}, parts: [] }));
      }

      return new Response("{}", { status: 404 });
    };

    const a = createOpencodeAgent(agentDefaults(), { ...serviceOverrides(), fetcher });
    const eventStore = createEventStore();

    const result = await a.resumeSession(
      {
        sessionId: "oc-1",
        prompt: "What's the weather like where you are today?: Nice",
        cwd: "/repo",
        questionResponse: { answers: [["Nice"]] },
      },
      eventStore,
    );

    const exit = await result.process!.onExit;
    const messagePatches = eventStore.getHistory().filter((patch: JsonPatch) => patch.path === "/messages");
    const lastMessages = messagePatches.at(-1)?.value as SessionMessage[];

    expect(exit.code).toBe(0);
    expect(replyBodies).toEqual([{ answers: [["Nice"]] }]);
    expect(lastMessages.at(-1)?.parts[0]).toMatchObject({
      type: "tool",
      tool: "question",
      state: { metadata: { answers: [["Nice"]] } },
    });

    eventStore.close();
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

    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";

      if (method === "GET" && url.pathname === "/question") {
        return new Response(
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
      }

      if (method === "POST" && url.pathname === "/question/que-weather/reply") {
        replyBodies.push(JSON.parse(init?.body as string));
        return new Response("true");
      }

      const messageMatch = url.pathname.match(/^\/session\/([^/]+)\/message$/);
      if (method === "GET" && messageMatch) {
        if (replyBodies.length > 0) messageGetsAfterReply += 1;
        const messages = [
          { role: "user", content: [{ type: "text", text: "Ask me about the weather" }] },
          questionMessage,
        ];
        return new Response(JSON.stringify(messageGetsAfterReply >= 5 ? [...messages, continuationMessage] : messages));
      }

      return new Response("{}", { status: 404 });
    };

    const a = createOpencodeAgent(agentDefaults(), { ...serviceOverrides(), fetcher });
    const eventStore = createEventStore();

    const result = await a.resumeSession(
      {
        sessionId: "oc-1",
        prompt: "What's the weather like where you are today?: Nice",
        cwd: "/repo",
        questionResponse: { answers: [["Nice"]] },
      },
      eventStore,
    );

    const exit = await result.process!.onExit;
    const messagePatches = eventStore.getHistory().filter((patch: JsonPatch) => patch.path === "/messages");
    const lastMessages = messagePatches.at(-1)?.value as SessionMessage[];

    expect(exit.code).toBe(0);
    expect(lastMessages.at(-1)?.parts[0]).toEqual({ type: "text", text: "Thanks, TypeScript works." });

    eventStore.close();
  }, 15_000);
});
