import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { CommandExecuteResponse } from "pstdio-api-contracts";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let close: () => Promise<void>;
let tempRoot: string;
let projectId: string;

const FIXTURE_SOURCE = `const COUNTER_KEY = "counter";

export default {
  id: "pstdio.lab",
  namespace: "lab",
  name: "Lab",
  commands: {
    "counter.bump": {
      title: "Bump counter",
      cli: true,
      async run(ctx) {
        const current = (await ctx.storage.get(COUNTER_KEY)) ?? 0;
        const amount = Number(ctx.params.amount ?? 1);
        const next = current + amount;
        await ctx.storage.set(COUNTER_KEY, next);
        return { counter: next };
      },
    },
    "counter.read": {
      title: "Read counter",
      cli: true,
      async run(ctx) {
        return { counter: (await ctx.storage.get(COUNTER_KEY)) ?? 0 };
      },
    },
    "slot.echo": {
      title: "Echo slot",
      async run(ctx) {
        return { slot: ctx.slot };
      },
    },
    awaken: {
      title: "Awaken",
      async run() {
        return { awakened: true };
      },
    },
    "demo.awaken": {
      title: "Demo awaken",
      cli: true,
      async run(ctx) {
        return ctx.commands.execute("lab.counter.bump", { params: { amount: 5 } });
      },
    },
  },
  middlewares: {
    rejectAwaken: {
      command: "lab.awaken",
      async handler(ctx) {
        const title = String(ctx.params.title ?? "");
        if (title.toUpperCase().includes("DOOM")) {
          return ctx.commands.reject({
            code: "doom_rejected",
            reason: 'Title contains DOOM — refusing.',
          });
        }
      },
    },
  },
  hooks: {
    onAwakenRejected: {
      event: "command.rejected:lab.awaken",
      async handler() {},
    },
  },
};
`;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-execute-cmd-test-"));
  const homeRoot = join(tempRoot, "home");
  const extensionsRoot = join(homeRoot, "extensions");
  const labDir = join(extensionsRoot, "lab");
  mkdirSync(labDir, { recursive: true });
  writeFileSync(join(labDir, "extension.ts"), FIXTURE_SOURCE);

  process.env.PSTDIO_HOME = homeRoot;

  ({ app, close } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  }));

  const createRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "ExecCmd Project" }),
  });
  const project = (await createRes.json()) as { id: string };
  projectId = project.id;
});

afterAll(async () => {
  delete process.env.PSTDIO_HOME;
  await close();
  rmSync(tempRoot, { recursive: true, force: true });
});

const post = async (commandId: string, body: object) =>
  app.request(`/v1/extensions/commands/${encodeURIComponent(commandId)}/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /v1/extensions/commands/:commandId/execute", () => {
  test("executes a command and persists state via extension storage", async () => {
    const checkRes = await app.request("/v1/extensions/check");
    const checkBody = (await checkRes.json()) as { commands: { id: string }[]; diagnostics: unknown[] };
    if (checkBody.commands.length === 0) {
      throw new Error(`runtime check missing commands: ${JSON.stringify(checkBody)}`);
    }

    const first = await post("lab.counter.bump", { projectId, params: { amount: 2 }, source: "cli" });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as CommandExecuteResponse;
    if (firstBody.outcome.status !== "success") {
      throw new Error(`unexpected outcome: ${JSON.stringify(firstBody.outcome)}`);
    }
    expect(firstBody.outcome.status).toBe("success");
    if (firstBody.outcome.status === "success") {
      expect(firstBody.outcome.value).toEqual({ counter: 2 });
    }

    const second = await post("lab.counter.bump", { projectId, params: { amount: 3 } });
    const secondBody = (await second.json()) as CommandExecuteResponse;
    expect(secondBody.outcome.status).toBe("success");
    if (secondBody.outcome.status === "success") {
      expect(secondBody.outcome.value).toEqual({ counter: 5 });
    }

    const read = await post("lab.counter.read", { projectId });
    const readBody = (await read.json()) as CommandExecuteResponse;
    expect(readBody.outcome.status).toBe("success");
    if (readBody.outcome.status === "success") {
      expect(readBody.outcome.value).toEqual({ counter: 5 });
    }
  });

  test("middleware rejection short-circuits the handler", async () => {
    const res = await post("lab.awaken", { projectId, params: { title: "DOOM riser" } });
    const body = (await res.json()) as CommandExecuteResponse;
    expect(body.outcome.status).toBe("rejected");
    if (body.outcome.status === "rejected") {
      expect(body.outcome.code).toBe("doom_rejected");
    }
  });

  test("nested command execution flows through the runner", async () => {
    const before = await post("lab.counter.read", { projectId });
    const beforeBody = (await before.json()) as CommandExecuteResponse;
    let baseline = 0;
    if (beforeBody.outcome.status === "success") {
      baseline = (beforeBody.outcome.value as { counter: number }).counter;
    }

    const res = await post("lab.demo.awaken", { projectId });
    const body = (await res.json()) as CommandExecuteResponse;
    expect(body.outcome.status).toBe("success");
    if (body.outcome.status === "success") {
      const inner = body.outcome.value as { status: string; value?: { counter?: number } };
      expect(inner.status).toBe("success");
      expect(inner.value?.counter).toBe(baseline + 5);
    }
  });

  test("forwards slot context into command execution", async () => {
    const res = await post("lab.slot.echo", {
      projectId,
      slot: {
        id: "project.headerPrimary",
        kind: "menu",
        context: { projectId },
      },
    });
    const body = (await res.json()) as CommandExecuteResponse;
    expect(body.outcome.status).toBe("success");
    if (body.outcome.status === "success") {
      expect(body.outcome.value).toEqual({
        slot: {
          id: "project.headerPrimary",
          kind: "menu",
          context: { projectId },
        },
      });
    }
  });

  test("returns command_not_found for unknown ids", async () => {
    const res = await post("lab.does-not-exist", { projectId });
    const body = (await res.json()) as CommandExecuteResponse;
    expect(body.outcome.status).toBe("error");
    if (body.outcome.status === "error") {
      expect(body.outcome.code).toBe("command_not_found");
    }
  });
});
