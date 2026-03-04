import { describe, expect, test } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../../types";
import { postShutdownHandler, postShutdownRoute } from "./post-shutdown";

describe("POST /shutdown", () => {
  test("returns ok and calls closeDb then exit", async () => {
    const calls: string[] = [];

    const app = new OpenAPIHono<AppBindings>();
    app.openapi(
      postShutdownRoute,
      postShutdownHandler({
        closeDb: async () => {
          calls.push("closeDb");
        },
        exit: () => {
          calls.push("exit");
        },
      }),
    );

    const res = await app.request("/shutdown", { method: "POST" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    await new Promise((r) => setTimeout(r, 100));

    expect(calls).toEqual(["closeDb", "exit"]);
  });
});
