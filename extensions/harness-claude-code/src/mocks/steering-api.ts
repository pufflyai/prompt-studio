// The real CLI runs against a local Messages API so protocol checks need no account or model access.
export const createSteeringApi = (command = "sleep 1 && echo native-tool-finished") => {
  let nextTool = true;
  const requests: string[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      if (request.method !== "POST") return new Response();
      const body = (await request.json()) as { model: string; stream?: boolean };
      if (new URL(request.url).pathname.includes("count_tokens")) return Response.json({ input_tokens: 10 });
      requests.push(JSON.stringify(body));
      const tool = nextTool;
      nextTool = false;
      const block = tool
        ? {
            type: "tool_use",
            id: `call-${requests.length}`,
            name: "Bash",
            input: { command, description: "Finish foreground work" },
          }
        : { type: "text", text: "Correction processed after native-tool-finished." };
      const message = {
        id: `message-${requests.length}`,
        type: "message",
        role: "assistant",
        model: body.model,
        content: [block],
        stop_reason: tool ? "tool_use" : "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 10 },
      };
      if (!body.stream) return Response.json(message);
      const event = (type: string, data: object) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
      return new Response(
        [
          event("message_start", { message: { ...message, content: [], stop_reason: null } }),
          event("content_block_start", {
            index: 0,
            content_block: tool ? { ...block, input: {} } : { type: "text", text: "" },
          }),
          event("content_block_delta", {
            index: 0,
            delta: tool
              ? { type: "input_json_delta", partial_json: JSON.stringify(block.input) }
              : { type: "text_delta", text: block.text },
          }),
          event("content_block_stop", { index: 0 }),
          event("message_delta", {
            delta: { stop_reason: message.stop_reason, stop_sequence: null },
            usage: { output_tokens: 10 },
          }),
          event("message_stop", {}),
        ].join(""),
        { headers: { "content-type": "text/event-stream" } },
      );
    },
  });
  return {
    requests,
    reset: () => {
      nextTool = true;
    },
    close: () => server.stop(true),
    env: {
      ANTHROPIC_API_KEY: "fixture-key",
      ANTHROPIC_BASE_URL: server.url.origin,
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    },
  };
};
