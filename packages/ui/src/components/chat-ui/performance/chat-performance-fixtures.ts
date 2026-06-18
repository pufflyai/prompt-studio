import type { SessionMessage } from "../components/message-types";

export interface LargeChatConversationOptions {
  sessionId: string;
  turns: number;
  textRepeat?: number;
  toolCallsPerTurn?: number;
}

export interface ChatPerformanceSession {
  id: string;
  label: string;
  messages: SessionMessage[];
}

const DEFAULT_TEXT_REPEAT = 4;
const DEFAULT_TOOL_CALLS_PER_TURN = 3;
export const CHAT_PERFORMANCE_STRESS_TURNS = 500;
export const CHAT_PERFORMANCE_STRESS_MESSAGE_COUNT = CHAT_PERFORMANCE_STRESS_TURNS * 2;

const userParagraphs = [
  "Please inspect the current implementation, explain the relevant tradeoffs, and keep the work scoped to the existing architecture.",
  "Use the repository conventions, keep the behavior easy to verify, and include enough context that the next person can reason about the change.",
  "When the implementation touches shared surfaces, call out the risks and make the validation path explicit.",
];

const assistantParagraphs = [
  "I traced the data flow through the route, store, and rendering layer, then narrowed the behavior to the smallest surface that needs to change.",
  "The implementation keeps the happy path direct while preserving the existing component and package boundaries.",
  "The remaining risk is concentrated in the expensive rendering path, so the benchmark should capture both initial load and incremental updates.",
];

const buildMarkdownDetails = (sessionId: string, turn: number) => [
  `Reference: [session hydration notes](https://example.com/${sessionId}/sessions/${turn}) and [stream replay trace](https://example.com/${sessionId}/stream/${turn}).`,
  [
    "| Surface | Load | Risk |",
    "| --- | ---: | --- |",
    `| transcript | ${turn + 1}20 rows | markdown parse pressure |`,
    `| tools | ${(turn % 4) + 3} calls | timeline layout churn |`,
    "| stream | 384 byte chunks | repeated text updates |",
  ].join("\n"),
  [
    "- [x] Keep REST hydration and SSE replay visible in the fixture",
    "- [ ] Capture browser long tasks",
    "- [ ] Compare session switch and stream update costs",
  ].join("\n"),
  [
    "```ts",
    `const sessionId = "${sessionId}";`,
    `const turnIndex = ${turn};`,
    "const shouldMeasure = messages.length > 100 && streaming === false;",
    "```",
  ].join("\n"),
];

const repeatText = (paragraphs: string[], repeat: number, sessionId: string, turn: number) =>
  Array.from({ length: repeat }, (_, index) => {
    const paragraph = `${paragraphs[index % paragraphs.length]} (${index + 1})`;
    const detail = buildMarkdownDetails(sessionId, turn).join("\n\n");
    return `${paragraph}\n\n${detail}`;
  }).join("\n\n");

const buildBashOutput = (sessionId: string, turn: number) =>
  Array.from({ length: 8 }, (_, index) => {
    const fileIndex = String(index + 1).padStart(2, "0");
    return `packages/ui/src/components/chat-ui/${sessionId}-${turn}-${fileIndex}.tsx:${12 + index}: rendered sample ${index + 1}`;
  }).join("\n");

const buildPatchDiff = (turn: number) =>
  [
    "--- a/packages/ui/src/components/chat-ui/session-row.tsx",
    "+++ b/packages/ui/src/components/chat-ui/session-row.tsx",
    "@@ -1,4 +1,5 @@",
    " export const SessionRow = () => {",
    "-  return <Row />;",
    "+  const measured = true;",
    "+  return <Row measured={measured} />;",
    " };",
    `# turn ${turn}`,
  ].join("\n");

const toolNames = ["read", "grep", "bash", "todo_write", "edit", "apply_patch", "glob", "skill"] as const;

const buildToolState = (sessionId: string, turn: number, tool: (typeof toolNames)[number]) => {
  switch (tool) {
    case "read":
      return {
        input: { filePath: `packages/ui/src/components/chat-ui/session-${turn}.tsx` },
        output: { filePath: `packages/ui/src/components/chat-ui/session-${turn}.tsx` },
      };
    case "grep":
      return {
        input: { pattern: "RichMessage|ToolInvocationTimeline|useStickToBottom", path: "packages/ui/src" },
        output: {
          stdout: buildBashOutput(sessionId, turn),
        },
      };
    case "bash":
      return {
        input: { cwd: `/tmp/${sessionId}`, command: "bun run --cwd packages/ui test" },
        output: {
          stdout: ["139 tests passed", "storybook build complete", "chat perf fixture generated"].join("\n"),
          exitCode: 0,
        },
      };
    case "todo_write":
      return {
        input: {
          todos: [
            { content: "Collect frame timing baseline", status: "completed" },
            { content: "Inspect markdown parse cost", status: "in_progress" },
            { content: "Compare streaming chunk sizes", status: "pending" },
          ],
        },
        output: {
          todos: [
            { content: "Collect frame timing baseline", status: "completed" },
            { content: "Inspect markdown parse cost", status: "completed" },
            { content: "Compare streaming chunk sizes", status: "pending" },
          ],
        },
      };
    case "edit":
      return {
        input: {
          filePath: "packages/ui/src/components/chat-ui/chat-panel.tsx",
          old_string: "const merged = mergeReasoningToolOnlyMessages(messages);",
          new_string: "const merged = mergeReasoningToolOnlyMessages(messages);",
        },
        output: {
          oldString: "const grouped = groupMessagesByTurn(messages);",
          newString: "const grouped = groupMessagesByTurn(merged);",
        },
      };
    case "apply_patch":
      return {
        input: { diff: buildPatchDiff(turn) },
        output: { metadata: { files: [{ filePath: "packages/ui/src/components/chat-ui/session-row.tsx" }] } },
      };
    case "glob":
      return {
        input: { pattern: "packages/ui/src/components/chat-ui/**/*.tsx" },
        output: {
          stdout: [
            "packages/ui/src/components/chat-ui/components/chat-panel.tsx",
            "packages/ui/src/components/chat-ui/components/message-parts-renderer.tsx",
            "packages/ui/src/components/chat-ui/components/tool-invocation-timeline.tsx",
          ].join("\n"),
        },
      };
    case "skill":
      return {
        input: { name: "performance-benchmarking" },
        output: {
          stdout: [
            '<skill_content name="performance-benchmarking">',
            "Measure user-visible timing first, then correlate with React and browser traces.",
            "</skill_content>",
          ].join("\n"),
        },
      };
  }
};

const buildToolPart = (sessionId: string, turn: number, toolIndex: number): SessionMessage["parts"][number] => {
  const tool = toolNames[(turn + toolIndex) % toolNames.length];
  const state = buildToolState(sessionId, turn, tool);

  return {
    type: "tool",
    tool,
    callId: `${sessionId}-tool-${turn}-${toolIndex}`,
    actionType: tool === "bash" ? "execute" : tool === "grep" || tool === "glob" || tool === "skill" ? "read" : "other",
    status: "completed",
    state: {
      status: "completed",
      ...state,
    },
  };
};

const buildUserMessage = (sessionId: string, turn: number, textRepeat: number): SessionMessage => ({
  id: `${sessionId}-user-${turn}`,
  role: "user",
  index: turn * 2,
  parts: [{ type: "text", text: repeatText(userParagraphs, textRepeat, sessionId, turn) }],
});

const buildAssistantMessage = (input: {
  sessionId: string;
  turn: number;
  textRepeat: number;
  toolCallsPerTurn: number;
}): SessionMessage => {
  const { sessionId, turn, textRepeat, toolCallsPerTurn } = input;

  return {
    id: `${sessionId}-assistant-${turn}`,
    role: "assistant",
    index: turn * 2 + 1,
    parts: [
      {
        type: "reasoning",
        text: repeatText(assistantParagraphs, Math.max(1, Math.ceil(textRepeat / 2)), sessionId, turn),
      },
      ...Array.from({ length: toolCallsPerTurn }, (_, toolIndex) => buildToolPart(sessionId, turn, toolIndex)),
      { type: "text", text: repeatText(assistantParagraphs, textRepeat, sessionId, turn) },
      {
        type: "token_usage",
        inputTokens: 1_000 + turn * 17,
        outputTokens: 500 + turn * 11,
        cacheReadTokens: 250,
      },
    ],
  };
};

export const buildLargeChatConversation = (options: LargeChatConversationOptions): SessionMessage[] => {
  const textRepeat = options.textRepeat ?? DEFAULT_TEXT_REPEAT;
  const toolCallsPerTurn = options.toolCallsPerTurn ?? DEFAULT_TOOL_CALLS_PER_TURN;
  const messages: SessionMessage[] = [];

  for (let turn = 0; turn < options.turns; turn += 1) {
    messages.push(buildUserMessage(options.sessionId, turn, textRepeat));
    messages.push(buildAssistantMessage({ sessionId: options.sessionId, turn, textRepeat, toolCallsPerTurn }));
  }

  return messages;
};

export const buildChatSessionSwitchFixture = () => ({
  primarySession: {
    id: "perf-session-primary",
    label: "Primary session",
    messages: buildLargeChatConversation({
      sessionId: "perf-primary",
      turns: CHAT_PERFORMANCE_STRESS_TURNS,
      textRepeat: 2,
      toolCallsPerTurn: 3,
    }),
  } satisfies ChatPerformanceSession,
  secondarySession: {
    id: "perf-session-secondary",
    label: "Secondary session",
    messages: buildLargeChatConversation({
      sessionId: "perf-secondary",
      turns: CHAT_PERFORMANCE_STRESS_TURNS,
      textRepeat: 2,
      toolCallsPerTurn: 4,
    }),
  } satisfies ChatPerformanceSession,
});

const isTextPart = (part: SessionMessage["parts"][number]): part is { type: "text"; text: string } =>
  part.type === "text";

export const seedStreamingMessage = (message: SessionMessage): SessionMessage => ({
  ...message,
  parts: message.parts.map((part) => (isTextPart(part) ? { ...part, text: "" } : part)),
});

export const updateStreamingTextPart = (
  messages: SessionMessage[],
  messageId: string,
  partIndex: number,
  text: string,
) => {
  return messages.map((message) => {
    if (message.id !== messageId) return message;

    const part = message.parts[partIndex];
    if (!part || !isTextPart(part)) return message;

    const parts = [...message.parts];
    parts[partIndex] = { ...part, text };
    return { ...message, parts };
  });
};
