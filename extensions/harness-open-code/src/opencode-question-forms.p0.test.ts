import { expect, test } from "bun:test";
import { createQuestionApi } from "./opencode-questions";

test("question replies omit unanswered optional fields without shifting later answers", async () => {
  let answer: unknown;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      if (request.method === "POST") {
        answer = await request.json();
        return new Response(null, { status: 204 });
      }
      return Response.json({
        data: {
          fields: [
            { type: "integer", key: "count", minimum: 1, required: false },
            { type: "string", key: "choice", options: [{ label: "Yes", value: "yes" }] },
          ],
        },
      });
    },
  });
  try {
    const api = createQuestionApi({ fetcher: fetch, withServerUrl: (action) => action(server.url.origin) });
    await api.replyQuestion("session", "form", [[], ["Yes"]]);
    expect(answer).toEqual({ answer: { choice: "yes" } });
  } finally {
    server.stop(true);
  }
});
