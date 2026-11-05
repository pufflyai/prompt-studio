import { expect, test } from "bun:test";
import { serviceOverrides } from "./harness.test-helpers";
import { createOpencodeService } from "./opencode-service";

test("loads native history pages without combining a cursor with order", async () => {
  const calls: URL[] = [];
  const service = createOpencodeService({
    ...serviceOverrides(),
    fetcher: async (input) => {
      const url = new URL(String(input));
      calls.push(url);
      if (!url.searchParams.has("cursor")) {
        expect(url.searchParams.get("order")).toBe("asc");
        return Response.json({
          data: [{ type: "user", id: "msg_user", text: "hello", time: { created: 1 } }],
          cursor: { next: "page_2" },
        });
      }
      expect(url.searchParams.has("order")).toBe(false);
      return Response.json({
        data: [
          {
            type: "idle",
            id: "msg_idle",
            outcome: "failed",
            error: { type: "api", message: "unavailable" },
            time: { created: 2 },
          },
        ],
        cursor: {},
      });
    },
  });
  try {
    const messages = await service.getSessionMessages("ses_one", "/workspace");
    expect(calls).toHaveLength(2);
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({
      info: { error: { data: { message: "unavailable" } }, time: { completed: 2 } },
    });
  } finally {
    await service.dispose();
  }
});
