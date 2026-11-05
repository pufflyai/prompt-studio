import { expect, test } from "bun:test";
import { createQuestionApi } from "./opencode-questions";

test("numeric zero and boolean false remain explicit question answers", async () => {
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
            { type: "number", key: "count" },
            { type: "boolean", key: "enabled" },
          ],
        },
      });
    },
  });
  try {
    const api = createQuestionApi({ fetcher: fetch, withServerUrl: (action) => action(server.url.origin) });
    await api.replyQuestion("session", "form", [["0"], ["false"]]);
    expect(answer).toEqual({ answer: { count: 0, enabled: false } });
  } finally {
    await server.stop(true);
  }
});

for (const type of ["number", "integer"] as const) {
  for (const value of ["", " "]) {
    test(`blank ${type} question replies are rejected before submission (${JSON.stringify(value)})`, async () => {
      let submissions = 0;
      const server = Bun.serve({
        port: 0,
        fetch(request) {
          if (request.method === "POST") {
            submissions++;
            return new Response(null, { status: 204 });
          }
          return Response.json({ data: { fields: [{ type, key: "count", required: false }] } });
        },
      });
      try {
        const api = createQuestionApi({ fetcher: fetch, withServerUrl: (action) => action(server.url.origin) });
        await expect(api.replyQuestion("session", "form", [[value]])).rejects.toThrow("Enter a valid number.");
        expect(submissions).toBe(0);
      } finally {
        await server.stop(true);
      }
    });
  }
}

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
