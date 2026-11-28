// Reply through the providers' HTTP protocols so the packaged harnesses still launch their real CLIs.
export const startHarnessModelFixture = () => {
  const requests = { codex: 0, claude: 0 };
  const reply = (provider: keyof typeof requests, turn: number) =>
    `Release smoke reply from ${provider}, turn ${turn}.`;
  const stream = (events: { type: string; [key: string]: unknown }[]) =>
    new Response(events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""), {
      headers: { "content-type": "text/event-stream" },
    });
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const { pathname } = new URL(request.url);
      if (pathname === "/v1/messages/count_tokens") return Response.json({ input_tokens: 10 });
      if (request.method !== "POST") return new Response(null, { status: 404 });
      const { model } = (await request.json()) as { model: string };
      if (pathname === "/v1/responses") {
        const turn = ++requests.codex;
        const id = `resp_release_${turn}`;
        const item = {
          type: "message",
          id: `msg_release_${turn}`,
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: reply("codex", turn), annotations: [] }],
        };
        const response = { id, object: "response", model, output: [], status: "in_progress" };
        return stream([
          { type: "response.created", response },
          { type: "response.output_item.done", output_index: 0, item },
          { type: "response.completed", response: { ...response, output: [item], status: "completed" } },
        ]);
      }
      if (pathname === "/v1/messages") {
        const turn = ++requests.claude;
        const message = {
          id: `msg_release_${turn}`,
          type: "message",
          role: "assistant",
          model,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 0 },
        };
        return stream([
          { type: "message_start", message },
          { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: reply("claude", turn) } },
          { type: "content_block_stop", index: 0 },
          {
            type: "message_delta",
            delta: { stop_reason: "end_turn", stop_sequence: null },
            usage: { output_tokens: 10 },
          },
          { type: "message_stop" },
        ]);
      }
      return new Response(null, { status: 404 });
    },
  });
  return {
    reply,
    close: () => server.stop(true),
    env: {
      OPENAI_API_KEY: "release-test-key",
      OPENAI_BASE_URL: `${server.url.origin}/v1`,
      ANTHROPIC_API_KEY: "release-test-key",
      ANTHROPIC_AUTH_TOKEN: "",
      ANTHROPIC_BASE_URL: server.url.origin,
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    },
  };
};
