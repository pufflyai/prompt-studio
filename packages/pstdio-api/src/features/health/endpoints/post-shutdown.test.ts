import { describe, expect, test } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../../types";
import { postShutdownHandler, postShutdownRoute } from "./post-shutdown";

const waitFor = async (condition: () => boolean, timeout = 1000) => {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 1));
  }
};

describe("POST /shutdown", () => {
  test("returns ok and calls shutdown then exit", async () => {
    const calls: string[] = [];

    const app = new OpenAPIHono<AppBindings>();
    app.openapi(
      postShutdownRoute,
      postShutdownHandler({
        shutdown: async () => {
          calls.push("shutdown");
        },
        exit: () => {
          calls.push("exit");
        },
      }),
    );

    const res = await app.request("/shutdown", { method: "POST" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    await waitFor(() => calls.length === 2);

    expect(calls).toEqual(["shutdown", "exit"]);
  });
});
